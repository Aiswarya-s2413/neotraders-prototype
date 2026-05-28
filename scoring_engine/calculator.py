import logging

logger = logging.getLogger(__name__)

# Constants defining the category of routes
EVALUATION_ROUTES = ["/subscription", "/payment"]
CORE_ROUTES = ["/trades", "/dashboard", "/market", "/pivots", "/wisdom", "/candlestick_pattern"]
FRICTION_ROUTES = ["/utils", "/profile"]

def calculate_user_scores(events: list[dict]) -> dict:
    """
    Computes High-Conviction, Friction, and Evaluation scores for a single user
    based on a sequence of their recent API events.
    
    events: List of dictionaries representing rows from `api_usage_events`.
            Expected keys: 'endpoint', 'status_code'
    """
    high_conviction = 0.0
    friction = 0.0
    evaluation = 0.0
    
    for event in events:
        endpoint = event.get("endpoint", "")
        status = event.get("status_code", 200)
        
        # 1. Friction Score Factors
        if status >= 400:
            # Errors heavily indicate friction/churn risk
            friction += 2.0
        elif any(endpoint.startswith(route) for route in FRICTION_ROUTES):
            # Constant tweaking in profiles/utils might indicate exploratory behavior
            friction += 0.2
            
        # 2. Evaluation Score Factors
        if any(endpoint.startswith(route) for route in EVALUATION_ROUTES):
            # Highly indicative of upgrade readiness or churn consideration
            evaluation += 5.0
            
        # 3. High-Conviction Score Factors
        if any(endpoint.startswith(route) for route in CORE_ROUTES):
            # Active platform usage
            high_conviction += 0.5
            
    # Apply logic for: Transition from active usage to pricing/plan-related endpoint activity
    if high_conviction > 20.0 and evaluation > 0:
        # Boost evaluation score if they are a strong user looking at pricing
        evaluation *= 1.5

    return {
        "high_conviction_score": min(round(high_conviction, 2), 100.0),
        "friction_score": min(round(friction, 2), 100.0),
        "evaluation_score": min(round(evaluation, 2), 100.0),
    }

def aggregate_all_user_scores(all_events: list[dict]) -> dict:
    """
    Groups events by user_id and calculates scores for each.
    """
    user_events_map = {}
    for event in all_events:
        uid = event.get("user_id")
        if not uid:
            continue
        if uid not in user_events_map:
            user_events_map[uid] = []
        user_events_map[uid].append(event)
        
    scores = {}
    for uid, events in user_events_map.items():
        scores[uid] = calculate_user_scores(events)
        
    return scores
