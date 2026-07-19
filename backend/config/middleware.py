"""
config/middleware.py — Request-lifecycle middleware.

RequestIDMiddleware (R-R5-02):
    Assigns a UUID4 per incoming HTTP request for end-to-end correlation.

    Priority order (from most-preferred ID source):
      1. X-Request-ID header sent by the client/proxy (preserves upstream IDs)
      2. New UUID4 generated here

    The ID is:
      - Set on request.request_id (accessible in views and serializers)
      - Stored in a thread-local (readable by RequestIDLogFilter in logging)
      - Echoed back as X-Request-ID response header (client-side correlation)
      - Cleared from thread-local after the response is sent (avoids leaks
        between requests when gunicorn reuses threads)

RequestIDLogFilter:
    Logging filter that injects request_id into every log record emitted
    during a request. Returns '-' outside a request context (management
    commands, Celery tasks, etc.) so JSON log lines always have the field.
"""

import uuid
import threading
import logging


# ── Thread-local storage ──────────────────────────────────────────────────────
_local = threading.local()


def get_current_request_id() -> str | None:
    """Return the request ID for the current thread, or None outside a request."""
    return getattr(_local, "request_id", None)


# ── Middleware ────────────────────────────────────────────────────────────────
class RequestIDMiddleware:
    """
    Attaches a unique request ID to every HTTP request and response.
    Must sit early in the MIDDLEWARE list (after CorsMiddleware, before
    everything else that logs) so logging from all later middleware / views
    carries the correct request_id.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Honour an upstream request ID if the proxy/gateway sends one;
        # otherwise generate a fresh UUID4.
        request_id = request.headers.get("X-Request-Id") or str(uuid.uuid4())
        request.request_id = request_id
        _local.request_id = request_id

        try:
            response = self.get_response(request)
            # Echo back so the client can correlate logs without server access.
            response["X-Request-ID"] = request_id
            return response
        finally:
            # GUARANTEED CLEANUP (try/finally): clears the thread-local even when
            # get_response() raises an unhandled exception.  Without this, a
            # crashing view would leave the old request_id set in the thread-local,
            # which would pollute the next request's structured log entries when
            # gunicorn reuses the same OS thread.
            _local.request_id = None


# ── Logging filter ────────────────────────────────────────────────────────────
class RequestIDLogFilter(logging.Filter):
    """
    Injects request_id into every log record so structured (JSON) log lines
    always contain a traceable ID without any per-call boilerplate.

    Usage in LOGGING config:
        'filters': {'request_id': {'()': 'config.middleware.RequestIDLogFilter'}}
    """

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = get_current_request_id() or "-"
        return True
