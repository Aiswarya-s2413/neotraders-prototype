import logging
from collections import defaultdict
from scoring_engine.calculator import CORE_ROUTES
from datetime import datetime

logger = logging.getLogger(__name__)

def calculate_feature_gap(user_events: list[dict], gold_standard: dict) -> tuple[str | None, float]:
    """
    Compares a user's feature usage against the gold standard.
    Returns the feature with the largest missing gap (feature_route, gap_percentage).
    """
    if not gold_standard or not user_events:
        return None, 0.0
        
    user_counts = defaultdict(int)
    total_core = 0
    
    for event in user_events:
        endpoint = event.get("endpoint", "")
        for route in CORE_ROUTES:
            if endpoint.startswith(route):
                user_counts[route] += 1
                total_core += 1
                break
                
    user_distribution = {}
    if total_core > 0:
        user_distribution = {
            route: (count / total_core) * 100 
            for route, count in user_counts.items()
        }
        
    biggest_gap_feature = None
    biggest_gap_val = 0.0
    
    for route, expected_pct in gold_standard.items():
        actual_pct = user_distribution.get(route, 0.0)
        gap = expected_pct - actual_pct
        
        # We only care about positive gaps (features they are under-using compared to power users)
        if gap > biggest_gap_val:
            biggest_gap_val = gap
            biggest_gap_feature = route
            
    return biggest_gap_feature, round(biggest_gap_val, 2)

def detect_habit_pattern(user_events: list[dict]) -> str:
    """
    Analyzes timestamps to classify the user's habit pattern.
    """
    if not user_events:
        return "Inactive"
        
    if len(user_events) < 5:
        return "Occasional Visitor"
        
    # Group events by Day and Hour (UTC)
    active_days = set()
    hour_counts = defaultdict(int)
    
    for event in user_events:
        ts = event.get("timestamp")
        if not isinstance(ts, datetime):
            continue
            
        active_days.add(ts.date())
        hour_counts[ts.hour] += 1
        
    # Are they active consistently? (e.g. at least 4 unique days)
    if len(active_days) < 4:
        return "Occasional Visitor"
        
    # Do they have a tight 4-hour window where the majority of their activity happens?
    sorted_hours = sorted(hour_counts.items(), key=lambda x: x[1], reverse=True)
    peak_hour = sorted_hours[0][0]
    
    # Calculate how many events happen between [peak_hour - 1, peak_hour + 2]
    ritual_window_events = sum(
        count for hour, count in hour_counts.items() 
        if (peak_hour - 1) <= hour <= (peak_hour + 2)
    )
    
    if (ritual_window_events / len(user_events)) > 0.60:
        return "Daily Ritual"
        
    return "Consistent User"

def analyze_user_benchmarks(user_id: str, events: list[dict], gold_standard: dict) -> dict:
    """Combines gap analysis and habit detection for a single user."""
    missing_feature, gap_pct = calculate_feature_gap(events, gold_standard)
    habit = detect_habit_pattern(events)
    
    return {
        "user_id": user_id,
        "missing_key_feature": missing_feature,
        "value_gap_percentage": gap_pct,
        "habit_classification": habit
    }
