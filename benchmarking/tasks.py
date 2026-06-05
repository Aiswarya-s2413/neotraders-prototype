import logging
import json
from celery import Celery
from celery.schedules import crontab
from datetime import datetime, timedelta, timezone
from analytics.tasks import get_db_connection
from psycopg2.extras import RealDictCursor
import os

from .baseline import generate_gold_standard_baseline
from .analyzer import analyze_user_benchmarks

logger = logging.getLogger(__name__)

CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
app = Celery("benchmarking_engine", broker=CELERY_BROKER_URL)

app.conf.beat_schedule = {
    # Regenerate Gold Standard Baseline every Sunday at 1AM UTC
    'generate-weekly-baseline': {
        'task': 'benchmarking.tasks.run_baseline_generation',
        'schedule': crontab(minute=0, hour=1, day_of_week='sunday'),
    },
    # Calculate gap analysis for all users daily at 2AM UTC
    'calculate-daily-benchmarks': {
        'task': 'benchmarking.tasks.run_user_benchmarking',
        'schedule': crontab(minute=0, hour=2),
    },
}

@app.task
def run_baseline_generation():
    """Generates the Gold Standard feature distribution of top users."""
    logger.info("Running weekly baseline generation task...")
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        generate_gold_standard_baseline(cursor, days_lookback=30)
        
        conn.commit()
        cursor.close()
        conn.close()
        logger.info("Successfully generated new Gold Standard baseline.")
    except Exception as e:
        logger.error(f"Failed to generate baseline: {e}")

@app.task
def run_user_benchmarking():
    """Runs gap analysis and habit detection for active users against the latest baseline."""
    logger.info("Running daily user benchmarking task...")
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # 1. Fetch latest baseline
        cursor.execute("""
            SELECT feature_distribution 
            FROM power_user_baseline 
            ORDER BY id DESC LIMIT 1
        """)
        baseline_row = cursor.fetchone()
        
        if not baseline_row:
            logger.warning("No baseline found. Please run the baseline generation task first.")
            return
            
        gold_standard = baseline_row["feature_distribution"]
        if isinstance(gold_standard, str):
            gold_standard = json.loads(gold_standard)
            
        # 2. Fetch recent events for active users (past 14 days for habit analysis)
        cutoff = datetime.now(timezone.utc) - timedelta(days=14)
        
        # A. Fetch from api_usage_events
        cursor.execute("""
            SELECT user_id, endpoint, timestamp 
            FROM api_usage_events 
            WHERE timestamp >= %s
        """, (cutoff,))
        api_events = cursor.fetchall()
        
        # B. Fetch from js_tracked_events
        cursor.execute("""
            SELECT COALESCE(user_email, 'anonymous') AS user_id, category_a, category_b, category_c, created_at AS timestamp
            FROM js_tracked_events 
            WHERE created_at >= %s
        """, (cutoff,))
        tracker_rows = cursor.fetchall()
        
        # C. Fetch from captured_events
        cursor.execute("""
            SELECT COALESCE(user_email, 'anonymous') AS user_id, category_a, category_b, category_c, created_at AS timestamp
            FROM captured_events 
            WHERE created_at >= %s
        """, (cutoff,))
        prototype_rows = cursor.fetchall()
        
        # Combine all events into standard format expected by group by logic
        all_events = []
        for ev in api_events:
            all_events.append(dict(ev))
            
        for row in tracker_rows:
            endpoint = "/dashboard"
            if row["category_a"]:
                endpoint = "/subscription"
            elif row["category_b"]:
                endpoint = "/trades"
            elif row["category_c"]:
                endpoint = "/utils"
            all_events.append({
                "user_id": row["user_id"],
                "endpoint": endpoint,
                "timestamp": row["timestamp"]
            })
            
        for row in prototype_rows:
            endpoint = "/dashboard"
            if row["category_a"]:
                endpoint = "/subscription"
            elif row["category_b"]:
                endpoint = "/trades"
            elif row["category_c"]:
                endpoint = "/utils"
            all_events.append({
                "user_id": row["user_id"],
                "endpoint": endpoint,
                "timestamp": row["timestamp"]
            })
        
        # Group by user
        user_events_map = {}
        for ev in all_events:
            uid = ev["user_id"]
            if uid not in user_events_map:
                user_events_map[uid] = []
            user_events_map[uid].append(ev)
            
        # 3. Analyze each user and save results
        upsert_query = """
            INSERT INTO user_benchmarks (user_id, missing_key_feature, value_gap_percentage, habit_classification, last_analyzed_at)
            VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) DO UPDATE SET
                missing_key_feature = EXCLUDED.missing_key_feature,
                value_gap_percentage = EXCLUDED.value_gap_percentage,
                habit_classification = EXCLUDED.habit_classification,
                last_analyzed_at = EXCLUDED.last_analyzed_at;
        """
        
        for user_id, events in user_events_map.items():
            result = analyze_user_benchmarks(user_id, events, gold_standard)
            
            cursor.execute(upsert_query, (
                result["user_id"],
                result["missing_key_feature"],
                result["value_gap_percentage"],
                result["habit_classification"]
            ))
            
        conn.commit()
        cursor.close()
        conn.close()
        
        logger.info(f"Successfully benchmarked {len(user_events_map)} users.")
        
    except Exception as e:
        logger.error(f"Failed to run user benchmarking: {e}")
