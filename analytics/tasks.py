import os
import logging
from .celery_app import app
import psycopg2
from psycopg2.extras import RealDictCursor

logger = logging.getLogger(__name__)

# Retrieve database credentials from environment variables
DB_HOST = os.getenv("ABACUS_DB_HOST", "localhost")
DB_PORT = os.getenv("ABACUS_DB_PORT", "5435")
DB_USER = os.getenv("ABACUS_DB_USER", "postgres")
DB_PASS = os.getenv("ABACUS_DB_PASS", "abacus_password")
DB_NAME = os.getenv("ABACUS_DB_NAME", "abacus")

def get_db_connection():
    """Establish a connection to the Abacus Database."""
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASS,
        dbname=DB_NAME
    )

@app.task(bind=True, max_retries=3)
def log_api_request(self, event_data: dict):
    """
    Celery task to asynchronously write API usage events to the Abacus Database.
    
    Expected event_data format:
    {
        "user_id": str | int,
        "endpoint": str,
        "method": str,
        "status_code": int,
        "response_time_ms": float,
        "timestamp": str (ISO 8601 format)
    }
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Execute lightweight insert. 
        # Note: Ensure the table `api_usage_events` exists in your Abacus DB.
        insert_query = """
            INSERT INTO api_usage_events 
            (user_id, endpoint, method, status_code, response_time_ms, timestamp)
            VALUES (%s, %s, %s, %s, %s, %s)
        """
        
        cursor.execute(insert_query, (
            event_data.get("user_id"),
            event_data.get("endpoint"),
            event_data.get("method"),
            event_data.get("status_code"),
            event_data.get("response_time_ms"),
            event_data.get("timestamp")
        ))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        logger.debug(f"Successfully logged event for user {event_data.get('user_id')}")

    except psycopg2.Error as exc:
        logger.error(f"Database error writing analytics event: {exc}")
        # Retry the task with exponential backoff (e.g., up to 3 times)
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)
    except Exception as exc:
        logger.error(f"Unexpected error in log_api_request task: {exc}")
