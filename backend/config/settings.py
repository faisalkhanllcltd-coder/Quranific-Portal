"""
Django settings for config project.

Reads sensitive values from environment variables with safe local-dev fallbacks.
In production, set these via your deployment platform (Render, Railway, etc.)
or a .env file loaded by your process manager.
"""

import os
import logging
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv
from django.core.exceptions import ImproperlyConfigured

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# ---------------------------------------------------------------------------
# LOAD ENVIRONMENT VARIABLES
# ---------------------------------------------------------------------------
# Since we centralized your .env to the root folder (above backend),
# we tell Django to look one directory up (BASE_DIR.parent).
load_dotenv(BASE_DIR.parent / '.env')

# ---------------------------------------------------------------------------
# CORE APPLICATION & SECURITY
# ---------------------------------------------------------------------------
DEBUG = os.environ.get('DJANGO_DEBUG', 'True').lower() in ('true', '1', 'yes')

# SECURITY FIX (C5): Eradicated hardcoded secrets. Enforces environment variables in Production.
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY')
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = 'django-insecure-local-dev-key-only-do-not-use-in-prod'
    else:
        raise ImproperlyConfigured("CRITICAL SECURITY HALT: DJANGO_SECRET_KEY environment variable is missing in production.")

# SECURITY FIX (C6): Strict host header validation to prevent injection attacks.
_allowed_hosts = os.environ.get('DJANGO_ALLOWED_HOSTS', '')
ALLOWED_HOSTS = _allowed_hosts.split(',') if _allowed_hosts else (['*'] if DEBUG else [])


# ---------------------------------------------------------------------------
# APPLICATION DEFINITION
# ---------------------------------------------------------------------------
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party Apps
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',

    # My Apps
    'accounts',
    'students',
    'log',
    'live_session',
    'payments',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # MUST BE FIRST
    'django.middleware.security.SecurityMiddleware',
    'config.middleware.RequestIDMiddleware',   # R-R5-02: request-ID tracing; must be early
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# ---------------------------------------------------------------------------
# DATABASE — Override via env vars in production
# ---------------------------------------------------------------------------
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('POSTGRES_DB', 'quranific'),
        'USER': os.environ.get('POSTGRES_USER', 'postgres'),
        'PASSWORD': os.environ.get('POSTGRES_PASSWORD', 'postgres'),
        'HOST': os.environ.get('POSTGRES_HOST', '127.0.0.1'),
        'PORT': os.environ.get('POSTGRES_PORT', '5432'),
        # ── CONNECTION POOLING (A-P6-02 / R-R3-02) ───────────────────────
        # CONN_MAX_AGE: seconds a DB connection is kept alive between requests
        # in the same gunicorn worker thread. Without this (default=0), Django
        # opens + tears down a TCP connection for every HTTP request — a heavy
        # overhead on OCI where the DB host is separate. Set 60s in .env.
        # CONN_HEALTH_CHECKS (Django 4.1+): pings the DB before reusing a
        # persistent connection, preventing stale-connection crashes from
        # firewall or pgBouncer idle timeouts.
        'CONN_MAX_AGE': int(os.environ.get('DB_CONN_MAX_AGE', '60')),
        'CONN_HEALTH_CHECKS': True,
    }
}

# ---------------------------------------------------------------------------
# PRODUCTION HARDENING (A-P7-01)
# ---------------------------------------------------------------------------
# All settings below activate only when DJANGO_DEBUG=False in the environment.
# Run `manage.py check --deploy` to verify before OCI deployment.
if not DEBUG:
    # ── TLS / HTTPS ──────────────────────────────────────────────────────────
    # Required behind OCI LB / Nginx: tells Django the original request was
    # HTTPS via the X-Forwarded-Proto header set by the proxy. Without this,
    # SECURE_SSL_REDIRECT causes an infinite 301 redirect loop because Django
    # only sees the internal HTTP connection from the proxy.
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = True

    # ── COOKIES ──────────────────────────────────────────────────────────────
    SESSION_COOKIE_SECURE = True   # Session cookie only sent over HTTPS
    CSRF_COOKIE_SECURE = True      # CSRF token cookie only sent over HTTPS

    # ── HSTS ─────────────────────────────────────────────────────────────────
    # Instructs browsers to only connect over HTTPS for 1 year.
    # WARNING: Only enable HSTS_PRELOAD after the site has been stable on HTTPS
    # for several weeks — it is very hard to undo once browsers cache it.
    SECURE_HSTS_SECONDS = 31536000          # 1 year
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

    # ── CONTENT SECURITY ─────────────────────────────────────────────────────
    SECURE_CONTENT_TYPE_NOSNIFF = True   # Block MIME-type sniffing
    X_FRAME_OPTIONS = 'DENY'             # Clickjacking protection

# ---------------------------------------------------------------------------
# PASSWORD VALIDATION
# ---------------------------------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ---------------------------------------------------------------------------
# INTERNATIONALIZATION
# ---------------------------------------------------------------------------
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# ---------------------------------------------------------------------------
# STATIC & MEDIA FILES
# ---------------------------------------------------------------------------
STATIC_URL = 'static/'
# BUGFIX (U10): Added STATIC_ROOT so collectstatic works in deployment
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles') 

MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ---------------------------------------------------------------------------
# CORS (A-P1-05 fix)
# ---------------------------------------------------------------------------
# CORS_ALLOW_ALL_ORIGINS = True with CORS_ALLOW_CREDENTIALS = True is unsafe:
# django-cors-headers reflects the incoming Origin instead of sending "*",
# so a request from evil.com gets a credentialed cross-origin response.
# Fix: always use an explicit allowlist; never open wildcard.
CORS_ALLOW_ALL_ORIGINS = False  # Unconditionally off — never use wildcard + credentials
CORS_ALLOW_CREDENTIALS = True

# Explicit origin allowlist — set DJANGO_CORS_ALLOWED_ORIGINS in .env.
# Dev default: Vite (5173) and CRA (3000) localhost ports.
_cors_origins_raw = os.environ.get('DJANGO_CORS_ALLOWED_ORIGINS', '')
if _cors_origins_raw.strip():
    CORS_ALLOWED_ORIGINS = [o.strip() for o in _cors_origins_raw.split(',') if o.strip()]
else:
    # Local dev fallback — localhost only, not 0.0.0.0 or any external IP
    CORS_ALLOWED_ORIGINS = [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
    ]

# ---------------------------------------------------------------------------
# REST FRAMEWORK & JWT
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    # BUGFIX (C14): Global edge pagination prevents database OOM crashes on massive data fetches
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
    # RATE LIMITING (A-P1-06): Global defaults are loose — tight limits applied
    # per-scope on auth endpoints via throttle_classes in the view.
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.ScopedRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        # Auth endpoints (login / refresh / register) — applied via throttle_scope
        'auth':     '5/minute',    # 5 attempts per minute per IP (brute-force protection)
        'register': '10/hour',     # 10 registrations per hour per IP (account farming protection)
        # Default fallback for any view that uses AnonRateThrottle / UserRateThrottle
        'anon':     '60/minute',
        'user':     '300/minute',
    },
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(
        days=int(os.environ.get('JWT_ACCESS_TOKEN_LIFETIME_DAYS', '1'))
    ),
    'REFRESH_TOKEN_LIFETIME': timedelta(
        days=int(os.environ.get('JWT_REFRESH_TOKEN_LIFETIME_DAYS', '7'))
    ),
    'AUTH_HEADER_TYPES': ('Bearer',),
    # Server-side logout: rotate refresh tokens and blacklist the old one on every
    # refresh call. The /logout/ view explicitly blacklists on logout.
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
}

# ---------------------------------------------------------------------------
# LOGGING — R-R5-02: Structured JSON logging with per-request tracing
# ---------------------------------------------------------------------------
# Formatter: always JSON (parseable by log aggregators in prod, readable in dev).
# Fields on every line: timestamp, level, logger, message, request_id.
# request_id is injected by RequestIDLogFilter from the thread-local set by
# RequestIDMiddleware; outside a request it falls back to "-".
#
# Log levels:
#   django.*  — DEBUG in dev (noisy SQL etc.), WARNING in prod
#   app loggers — INFO in both (payment/auth events are always worth keeping)
#   root        — WARNING (catches any unregistered third-party logger)
# ---------------------------------------------------------------------------
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,

    # ── Filters ──────────────────────────────────────────────────────────────
    'filters': {
        'request_id': {
            # Injects record.request_id from thread-local on every log call
            '()': 'config.middleware.RequestIDLogFilter',
        },
    },

    # ── Formatters ───────────────────────────────────────────────────────────
    'formatters': {
        'json': {
            # python-json-logger 4.x: fields listed in fmt are included in the
            # JSON output.  rename_fields maps log-record attribute names to the
            # JSON key names that appear in the output.
            # request_id is injected per-record by RequestIDLogFilter (see filters).
            '()': 'pythonjsonlogger.json.JsonFormatter',
            'fmt': '%(asctime)s %(levelname)s %(name)s %(message)s %(request_id)s',
            'rename_fields': {
                'asctime':   'timestamp',
                'levelname': 'level',
                'name':      'logger',
            },
        },
        'simple': {
            # Fallback for any handler that can't use JSON (e.g. email)
            'format': '[{asctime}] {levelname} {name} {message} (req={request_id})',
            'datefmt': '%Y-%m-%dT%H:%M:%S',
            'style': '{',
        },
    },

    # ── Handlers ─────────────────────────────────────────────────────────────
    'handlers': {
        'console': {
            'class':     'logging.StreamHandler',
            'formatter': 'json',
            'filters':   ['request_id'],
        },
    },

    # ── Per-logger configuration ──────────────────────────────────────────────
    'loggers': {
        # Django internals: verbose in dev, quiet in prod
        'django': {
            'handlers':  ['console'],
            'level':     'DEBUG' if DEBUG else 'WARNING',
            'propagate': False,
        },
        'django.request': {
            'handlers':  ['console'],
            'level':     'ERROR',   # 4xx/5xx only — avoids 200-OK noise
            'propagate': False,
        },
        # App loggers — INFO in both envs (payment/auth events always visible)
        'accounts':    {'handlers': ['console'], 'level': 'INFO',  'propagate': False},
        'payments':    {'handlers': ['console'], 'level': 'INFO',  'propagate': False},
        'students':    {'handlers': ['console'], 'level': 'INFO',  'propagate': False},
        'live_session':{'handlers': ['console'], 'level': 'INFO',  'propagate': False},
        'log':         {'handlers': ['console'], 'level': 'INFO',  'propagate': False},
    },

    # Root logger: catches any unregistered logger at WARNING+
    'root': {
        'handlers': ['console'],
        'level':    'WARNING',
    },
}

# ---------------------------------------------------------------------------
# SENTRY — R-R5-01: Error monitoring (production only)
# ---------------------------------------------------------------------------
# App runs cleanly if SENTRY_DSN is unset (CI, local dev) — init is skipped.
# In production, set SENTRY_DSN to your project's ingest URL.
# SENTRY_TRACES_SAMPLE_RATE: 0.0–1.0; 0.1 = 10 % of transactions traced.
# send_default_pii=False: do not attach user email / IP to events (GDPR).
# ---------------------------------------------------------------------------
_sentry_dsn = os.environ.get('SENTRY_DSN', '').strip()
if not DEBUG and _sentry_dsn:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration
    from sentry_sdk.integrations.logging import LoggingIntegration

    # Capture ERROR-level log calls as Sentry breadcrumbs, CRITICAL as events.
    _sentry_logging = LoggingIntegration(
        level=logging.INFO,           # Breadcrumb threshold
        event_level=logging.ERROR,    # Sentry event threshold (not CRITICAL — catches all errors)
    )

    sentry_sdk.init(
        dsn=_sentry_dsn,
        integrations=[DjangoIntegration(), _sentry_logging],
        traces_sample_rate=float(os.environ.get('SENTRY_TRACES_SAMPLE_RATE', '0.1')),
        send_default_pii=False,
        environment=os.environ.get('DJANGO_ENVIRONMENT', 'production'),
        release=os.environ.get('SENTRY_RELEASE', None),
        # Suppress noisy Sentry SDK debug output
        debug=False,
    )

# ---------------------------------------------------------------------------
# CELERY & REDIS (R-R3-01 / A-P4-04)
# ---------------------------------------------------------------------------
_redis_url = os.environ.get('REDIS_URL', 'redis://127.0.0.1:6379/0')
# Change the db index from 0 to 1 for celery to avoid cache collision (R-R3-04)
_celery_redis_url = _redis_url.rsplit('/', 1)[0] + '/1'

CELERY_BROKER_URL = _celery_redis_url
CELERY_RESULT_BACKEND = _celery_redis_url
CELERY_TASK_ALWAYS_EAGER = os.environ.get('CELERY_TASK_ALWAYS_EAGER', 'False').lower() in ('true', '1', 'yes')