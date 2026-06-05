import logging
from datetime import datetime, timedelta, timezone
from celery import Celery
from celery.schedules import crontab
from analytics.tasks import get_db_connection
from psycopg2.extras import RealDictCursor
from .calculator import aggregate_all_user_scores
import os

logger = logging.getLogger(__name__)

# Re-use the celery app configuration from analytics but add beat schedules
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
app = Celery("scoring_engine", broker=CELERY_BROKER_URL)

app.conf.beat_schedule = {
    # Run the scoring engine every night at midnight UTC
    'calculate-daily-intent-scores': {
        'task': 'scoring_engine.tasks.run_intent_scoring',
        'schedule': crontab(minute=0, hour=0),
    },
}

@app.task
def run_intent_scoring(days_lookback=7):
    """
    Main job that pulls the last X days of API usage events,
    calculates intent scores for each user, and saves them back to the DB.
    """
    logger.info(f"Starting intent scoring engine job. Lookback: {days_lookback} days.")
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # 1. Fetch recent events
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_lookback)
        
        # A. Fetch from api_usage_events
        cursor.execute(
            """
            SELECT user_id, endpoint, status_code 
            FROM api_usage_events 
            WHERE timestamp >= %s
            """,
            (cutoff_date,)
        )
        api_events = cursor.fetchall()
        
        # B. Fetch from js_tracked_events
        cursor.execute(
            """
            SELECT COALESCE(user_email, 'anonymous') AS user_id, category_a, category_b, category_c
            FROM js_tracked_events 
            WHERE created_at >= %s
            """,
            (cutoff_date,)
        )
        tracker_rows = cursor.fetchall()
        
        # C. Fetch from captured_events
        cursor.execute(
            """
            SELECT COALESCE(user_email, 'anonymous') AS user_id, category_a, category_b, category_c
            FROM captured_events 
            WHERE created_at >= %s
            """,
            (cutoff_date,)
        )
        prototype_rows = cursor.fetchall()
        
        # Combine all events into the standard format expected by aggregate_all_user_scores
        events = []
        for ev in api_events:
            events.append(dict(ev))
            
        for row in tracker_rows:
            endpoint = "/dashboard"
            status_code = 200
            if row["category_a"]:
                endpoint = "/subscription"
            elif row["category_b"]:
                endpoint = "/trades"
            elif row["category_c"]:
                endpoint = "/utils"
                status_code = 500
            events.append({
                "user_id": row["user_id"],
                "endpoint": endpoint,
                "status_code": status_code
            })
            
        for row in prototype_rows:
            endpoint = "/dashboard"
            status_code = 200
            if row["category_a"]:
                endpoint = "/subscription"
            elif row["category_b"]:
                endpoint = "/trades"
            elif row["category_c"]:
                endpoint = "/utils"
                status_code = 500
            events.append({
                "user_id": row["user_id"],
                "endpoint": endpoint,
                "status_code": status_code
            })
            
        logger.info(f"Fetched {len(events)} events (combined API, tracker, and prototype) for processing.")
        
        # 2. Calculate scores
        scores_by_user = aggregate_all_user_scores(events)
        logger.info(f"Calculated scores for {len(scores_by_user)} users.")
        
        # 3. Upsert scores into the database
        upsert_query = """
            INSERT INTO user_intent_scores (user_id, high_conviction_score, friction_score, evaluation_score, last_calculated_at)
            VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) DO UPDATE SET
                high_conviction_score = EXCLUDED.high_conviction_score,
                friction_score = EXCLUDED.friction_score,
                evaluation_score = EXCLUDED.evaluation_score,
                last_calculated_at = EXCLUDED.last_calculated_at;
        """
        
        for user_id, scores in scores_by_user.items():
            cursor.execute(upsert_query, (
                user_id,
                scores["high_conviction_score"],
                scores["friction_score"],
                scores["evaluation_score"]
            ))
            
        conn.commit()
        cursor.close()
        conn.close()
        
        logger.info("Successfully updated intent scores.")
        
    except Exception as e:
        logger.error(f"Failed to run intent scoring engine: {e}")
