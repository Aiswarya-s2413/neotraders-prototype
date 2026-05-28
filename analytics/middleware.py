import time
import logging
from datetime import datetime, timezone
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request, Response
from .tasks import log_api_request

logger = logging.getLogger(__name__)

# Endpoints that should not be tracked by the analytics engine
EXCLUDED_PATHS = {
    "/docs",
    "/openapi.json",
    "/redoc",
    "/",
    "/health",
    "/metrics"
}

def extract_user_id(request: Request) -> str | None:
    """
    Extracts the user ID from the request.
    Adjust this method based on NeoTrader's specific authentication mechanism.
    """
    # 1. Check if the User object is injected into request state by an existing Auth middleware.
    # E.g., if NeoTrader uses `request.state.user.id`
    if hasattr(request.state, "user") and request.state.user:
        if hasattr(request.state.user, "id"):
            return str(request.state.user.id)
        # Alternatively, it might just be the ID directly: request.state.user
        if isinstance(request.state.user, (str, int)):
            return str(request.state.user)
            
    # 2. Extract from Authorization Header (If using JWT directly)
    # auth_header = request.headers.get("Authorization")
    # if auth_header and auth_header.startswith("Bearer "):
    #     token = auth_header.split(" ")[1]
    #     try:
    #         # Example: payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    #         # return str(payload.get("sub"))
    #         pass
    #     except Exception:
    #         pass

    return None

class AnalyticsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip tracking for excluded routes
        if request.url.path in EXCLUDED_PATHS:
            return await call_next(request)

        start_time = time.time()
        
        # Process the actual request
        response = await call_next(request)
        
        # Calculate processing time in milliseconds
        process_time_ms = (time.time() - start_time) * 1000.0

        try:
            # Attempt to extract user ID. 
            user_id = extract_user_id(request)
            
            # Module 1 specification: We skip unauthenticated requests.
            # Only events with a real user ID are recorded.
            if user_id:
                event_data = {
                    "user_id": user_id,
                    "endpoint": request.url.path,
                    "method": request.method,
                    "status_code": response.status_code,
                    "response_time_ms": round(process_time_ms, 2),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }

                # Dispatch the event asynchronously to Celery
                # .delay() is non-blocking and executes in roughly ~0.1ms
                log_api_request.delay(event_data)
                
        except Exception as e:
            # We fail silently so that the analytics tracker never impacts the user response
            logger.error(f"Failed to queue analytics event: {e}")

        return response
