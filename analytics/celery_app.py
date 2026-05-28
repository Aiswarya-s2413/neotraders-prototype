import os
from celery import Celery

# Use Redis as the default broker, but allow overriding via environment variables
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")

# Initialize the Celery application
app = Celery(
    "abacus_analytics",
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND,
    include=["analytics.tasks"]
)

# Optional configuration settings for Celery
app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # Ensure tasks are retried on connection errors
    broker_connection_retry_on_startup=True,
)
