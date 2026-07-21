# ─────────────────────────────────────────────────────────────────────────────
# backend/Dockerfile  — A-P7-04
# Multi-stage build: keeps the final image lean (no build tools in prod).
# ─────────────────────────────────────────────────────────────────────────────

# Stage 1 — dependency builder
FROM python:3.11-slim AS builder

# Install only what's needed to compile psycopg2-binary and other C extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY requirements*.txt .
RUN pip install --upgrade pip && \
    pip install --prefix=/install --no-cache-dir -r requirements-prod.txt


# Stage 2 — runtime image
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=config.settings

# Runtime OS deps only (libpq for psycopg2)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for running the app
RUN groupadd --system appgroup && useradd --system --gid appgroup appuser

WORKDIR /app

# Copy installed packages from builder stage
COPY --from=builder /install /usr/local

# Copy application source
COPY . .

# Collect static files (runnable even without a DB connection)
RUN python manage.py collectstatic --noinput --clear 2>/dev/null || true

# Ensure the app user owns the workdir
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 8000

# Use gunicorn in production; 2 workers per CPU core is a common starting point.
# Adjust --workers based on OCI instance size.
CMD ["gunicorn", "config.wsgi:application", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "3", \
     "--timeout", "120", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
