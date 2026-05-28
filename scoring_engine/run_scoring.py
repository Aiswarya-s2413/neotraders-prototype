import logging
from scoring_engine.tasks import run_intent_scoring

# Configure basic logging to see the output in the console
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

if __name__ == "__main__":
    print("Starting Manual Intent Scoring Run...")
    
    # You can pass a custom lookback period, e.g., 30 days
    # This calls the inner function synchronously without Celery
    run_intent_scoring(days_lookback=7)
    
    print("Finished Manual Intent Scoring Run.")
