# NeoTrader Usage Instrumentation Layer (Abacus Analytics)

This module captures API usage events asynchronously via a FastAPI middleware and queues them into Redis using Celery. A Celery worker then processes the events and writes them directly into the Abacus database. This approach guarantees zero impact on the end-user API response latency.

## Prerequisites

- Redis server running (default: `localhost:6379`)
- `celery` and `psycopg2-binary` installed in your Python environment:
  ```bash
  pip install celery psycopg2-binary
  ```

## 1. Environment Setup

Add the following environment variables to your `.env` file or deployment environment. Adjust the values for your production environment.

```env
# Celery Configuration
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# Abacus Database Credentials
ABACUS_DB_HOST=localhost
ABACUS_DB_PORT=5432
ABACUS_DB_USER=postgres
ABACUS_DB_PASS=your_password
ABACUS_DB_NAME=abacus
```

## 2. FastAPI Application Integration

To hook the analytics middleware into the NeoTrader application, add exactly two lines to your `main.py` file:

```python
from fastapi import FastAPI
# ... your existing imports ...

# 1. IMPORT THE MIDDLEWARE
from analytics.middleware import AnalyticsMiddleware

app = FastAPI()

# ... existing code (DB initialization, routers, etc) ...

# 2. ADD THE MIDDLEWARE TO THE APP
app.add_middleware(AnalyticsMiddleware)

# ... existing CORS middleware ...
```

**Note on User Identification:** 
The middleware attempts to extract the User ID from `request.state.user`. If your application uses a different authentication method (like directly parsing JWTs from the headers), please update the `extract_user_id` function inside `analytics/middleware.py` accordingly.

## 3. Running the Celery Worker

The Celery worker runs as a separate background process. It picks up tasks from Redis and writes them to the Abacus DB.

Start the worker from the root of your project:
```bash
celery -A analytics.celery_app worker --loglevel=info
```

## Architecture Flow

1. **User Request**: User calls an authenticated API endpoint.
2. **FastAPI Processes**: NeoTrader handles the request normally.
3. **Middleware Intercepts Response**: The `AnalyticsMiddleware` calculates response time and extracts event data (status code, method, endpoint, user ID).
4. **Async Task Queued**: Middleware calls `.delay()`, dropping the payload onto Redis in ~0.1ms.
5. **Response Sent**: The user receives their response instantly.
6. **Worker Writes to DB**: The Celery worker picks the task from Redis and writes it to the Abacus Database using `psycopg2`.
