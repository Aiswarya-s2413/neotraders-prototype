import logging

logger = logging.getLogger(__name__)

# Constants defining the category of API routes
EVALUATION_ROUTES = ["/subscription", "/payment"]
CORE_ROUTES = ["/trades", "/dashboard", "/market", "/pivots", "/wisdom", "/candlestick_pattern"]
FRICTION_ROUTES = ["/utils", "/profile"]

def calculate_user_scores(events: list[dict]) -> dict:
    """
    Computes High-Conviction, Friction, and Evaluation scores for a single user
    based on a sequence of their recent events.

    Handles two types of events:
    - API events:     { source: 'api', endpoint: str, status_code: int }
    - Tracker/UI events: { source: 'tracker'|'prototype', category_a: bool, category_b: bool, category_c: bool }

    High-Conviction scoring reflects all 3 signal types from the analytics model:

      Signal Type 1 — Page Views (category_a)
        Visits to major pages: Dashboard, Running Ticker, Trades, Pivots, CPI, Candlestick.
        Each distinct page visit scores +1.0.

      Signal Type 2 — Active User Interactions (category_b)
        Meaningful in-page actions: button clicks, chart controls (style, resolution, multisignal),
        filter changes, watchlist additions, Long/Short toggles, trade submissions, chat button usage,
        CPI region/granularity changes, candlestick pattern selection.
        Each interaction scores +2.0 — weighted higher because active usage indicates deeper engagement.

      Signal Type 3 — Deep Engagement Toggles (category_c)
        High-intent interactions: toggling technical indicators (RSI, MACD, Bollinger Bands),
        expanding pivot/CPI accordion sections, exporting pivot data.
        Each scores +3.0 — highest weight as these indicate power-user-level exploration.

    API events additionally feed Friction and Evaluation scores (unchanged from prior logic).
    """
    high_conviction = 0.0
    friction = 0.0
    evaluation = 0.0

    for event in events:
        source = event.get("source", "api")

        if source in ("tracker", "prototype"):
            # --- UI / Tracker Events: Score all 3 Loom signal types ---
            cat_a = event.get("category_a", False)
            cat_b = event.get("category_b", False)
            cat_c = event.get("category_c", False)

            if cat_c:
                # Signal Type 3: Deep engagement toggle
                # (technical indicators, pivot accordion expand, export CSV)
                high_conviction += 3.0
            elif cat_b:
                # Signal Type 2: Active interaction
                # (chart control, filter, watchlist add, Long/Short toggle, trade, chat)
                high_conviction += 2.0
            elif cat_a:
                # Signal Type 1: Page view
                # (navigated to a portal tab: dashboard, ticker, trades, pivots, cpi, candlestick)
                high_conviction += 1.0
            else:
                # Untagged event — treat as a basic page view
                high_conviction += 0.5

        else:
            # --- API Events: Endpoint-based scoring ---
            endpoint = event.get("endpoint", "")
            status = event.get("status_code", 200)

            # Friction Score: errors indicate confusion or churn risk
            if status >= 400:
                friction += 2.0
            elif any(endpoint.startswith(route) for route in FRICTION_ROUTES):
                # Repeated profile/utils tweaking may indicate exploratory friction
                friction += 0.2

            # Evaluation Score: pricing/payment page visits signal upgrade intent
            if any(endpoint.startswith(route) for route in EVALUATION_ROUTES):
                evaluation += 5.0

            # High-Conviction from API-level core page usage
            if any(endpoint.startswith(route) for route in CORE_ROUTES):
                high_conviction += 0.5

    # Boost evaluation if user is both highly active AND exploring pricing
    if high_conviction > 20.0 and evaluation > 0:
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
