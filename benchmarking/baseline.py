import logging
from collections import defaultdict
from scoring_engine.calculator import CORE_ROUTES

logger = logging.getLogger(__name__)

def generate_gold_standard_baseline(cursor, days_lookback=30) -> dict | None:
    """
    Identifies the top 10% of users by high_conviction_score,
    fetches their API events from the past `days_lookback` days,
    and calculates the average distribution of their CORE feature usage.
    """
    logger.info("Generating Gold Standard Baseline profile...")
    
    # 1. Identify Top 10% of active users
    cursor.execute("""
        SELECT user_id 
        FROM user_intent_scores 
        WHERE high_conviction_score > 0
        ORDER BY high_conviction_score DESC
    """)
    active_users = cursor.fetchall()
    
    if not active_users:
        logger.warning("No active users found to generate baseline.")
        return None
        
    top_10_percent_count = max(1, int(len(active_users) * 0.10))
    top_users = [user["user_id"] for user in active_users[:top_10_percent_count]]
    
    logger.info(f"Top 10% isolated. Sampling {len(top_users)} power users.")
    
    # 2. Fetch their recent events
    placeholders = ', '.join(['%s'] * len(top_users))
    query = f"""
        SELECT endpoint
        FROM api_usage_events
        WHERE user_id IN ({placeholders})
        AND timestamp >= CURRENT_DATE - INTERVAL '{days_lookback} days'
    """
    cursor.execute(query, tuple(top_users))
    events = cursor.fetchall()
    
    if not events:
        return None
        
    # 3. Calculate feature distribution among CORE features
    feature_counts = defaultdict(int)
    total_core_events = 0
    
    for event in events:
        endpoint = event.get("endpoint", "")
        # Only analyze distribution across core features (ignore auth/utils)
        for route in CORE_ROUTES:
            if endpoint.startswith(route):
                feature_counts[route] += 1
                total_core_events += 1
                break
                
    if total_core_events == 0:
        return None
        
    distribution = {
        route: round((count / total_core_events) * 100, 2)
        for route, count in feature_counts.items()
    }
    
    logger.info(f"Baseline feature distribution calculated: {distribution}")
    
    # Save to database
    import json
    cursor.execute(
        """
        INSERT INTO power_user_baseline (feature_distribution, user_count_sampled)
        VALUES (%s, %s)
        """,
        (json.dumps(distribution), len(top_users))
    )
    
    return distribution
