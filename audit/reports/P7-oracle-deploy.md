# P7 — OCI Deployment Readiness

**Status: DONE**
Audit date: 2026-07-17

---

## Findings

### [CRITICAL] No HTTPS configuration exists in the repo
- Where: Entire project
- Issue: No Nginx/Caddy config, no Let's Encrypt / OCI Certificate Manager references, no SSL-related settings in `settings.py`. `SECURE_SSL_REDIRECT`, `SECURE_HSTS_SECONDS`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE` are all absent from `settings.py`.
- Impact: If deployed as-is, app runs over plain HTTP — all user credentials (children's passwords, JWT tokens) are transmitted unencrypted. `wss://` for LiveKit requires HTTPS. Browser will block WebSocket upgrade to `wss://` from an HTTP origin.
- Fix direction: Add Nginx reverse proxy config with Let's Encrypt / OCI Certificate; set all Django security settings for production: `SECURE_SSL_REDIRECT=True`, `SECURE_HSTS_SECONDS=31536000`, `SESSION_COOKIE_SECURE=True`, `CSRF_COOKIE_SECURE=True`
- Effort: M

### [CRITICAL] `DEBUG=True` and `ALLOWED_HOSTS=*` in shipped `.env`
- Where: `.env:11-12`
- Issue: Already documented in P1. If this `.env` is deployed to OCI, Django runs in debug mode with wildcard host validation.
- Impact: Debug mode exposes full Python tracebacks including local variable values (including passwords, tokens) in HTTP error responses. Attack surface for host-header injection is unlimited.
- Fix direction: Create a separate `.env.production` with `DEBUG=False`, `ALLOWED_HOSTS=your-oci-hostname`; never deploy `.env` (development) to OCI
- Effort: S

### [CRITICAL] No `gunicorn` or WSGI/ASGI production server configured
- Where: `backend/requirements.txt` (no `gunicorn` or `uvicorn`)
- Issue: `gunicorn` is not in `requirements.txt`. Django's development server (`manage.py runserver`) is NOT suitable for production — it is single-threaded and has known security and reliability issues.
- Impact: If deployed with `runserver`, the app handles one request at a time, crashes on unhandled exceptions, and exposes development server debug info. Memory leaks accumulate without process restart.
- Fix direction: Add `gunicorn==21.x` to `requirements.txt`; add `gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 4` to the backend docker-compose service; or add a `Procfile`
- Effort: S

### [HIGH] No `Dockerfile` or container build configuration
- Where: Root directory
- Issue: `docker-compose.yml` defines `db`, `redis`, and `livekit` services but there is NO `backend` or `frontend` service — no `image` or `build` directive for the application itself. `docker-compose.yml` currently only provisions infrastructure, not the app.
- Impact: OCI Container Instances / OKE deployment requires Docker images. Without a `Dockerfile`, there is no repeatable build process. Deployment is manual, fragile, and non-reproducible.
- Fix direction: Add `Dockerfile` for backend (`python:3.12-slim`, `pip install`, `migrate`, `gunicorn`); add `Dockerfile` for frontend (`node:20`, `npm build`, Nginx static serve); add both to `docker-compose.yml`
- Effort: M

### [HIGH] PostgreSQL port 5432 exposed to host in `docker-compose.yml`
- Where: `docker-compose.yml:14-15`
- Issue: `ports: - "5432:5432"` on the `db` service exposes PostgreSQL to `0.0.0.0:5432` on the host. On OCI, this means the database is reachable from the public internet if the OCI Security List allows port 5432.
- Impact: PostgreSQL with default credentials (`postgres`/`postgres`) exposed to the internet = immediate data breach risk
- Fix direction: Remove the `ports` directive from `db` service; let backend connect via Docker network name `db:5432` internally; block port 5432 in OCI Security List
- Effort: S

### [HIGH] Redis port 6379 also exposed to host
- Where: `docker-compose.yml:29-30`
- Issue: `ports: - "6379:6379"` on `redis` — Redis has no authentication configured (`requirepass` not set in compose or livekit.yaml). Redis exposed to internet = remote command execution vector.
- Impact: Unauthorized Redis access; cache poisoning; potential RCE via Redis config set command
- Fix direction: Remove `ports` from `redis` service; add `requirepass` via env var; Redis should only be reachable within the Docker network
- Effort: S

### [HIGH] LiveKit container runs with `--dev` flag
- Where: `docker-compose.yml:44`
- Issue: `command: --dev --config /livekit.yaml` — `--dev` mode in LiveKit disables security features including token verification strictness and enables API key fallbacks.
- Impact: LiveKit room tokens may not be properly verified in dev mode; any participant could join any room; recording/egress may be unrestricted
- Fix direction: Remove `--dev` flag for production; ensure `livekit.yaml` has proper key, port, and TLS configuration
- Effort: S

### [MEDIUM] No `django check --deploy` validation documented
- Where: Deployment documentation (none exists)
- Issue: No deployment checklist, no `python manage.py check --deploy` command documented. This command checks for common misconfigurations (DEBUG, ALLOWED_HOSTS, SECRET_KEY, SSL settings).
- Impact: Pre-launch deployment errors could be missed
- Fix direction: Add `manage.py check --deploy` to CI/CD pipeline; document deployment checklist
- Effort: S

### [MEDIUM] No environment-specific requirements split
- Where: `backend/requirements.txt`
- Issue: Single `requirements.txt` includes all packages for both dev and prod. Development tools (if any) would be installed in production. More importantly, `psycopg2-binary` should be `psycopg2` in production (binary wheels have licensing and platform issues in some OCI environments).
- Impact: `psycopg2-binary` is documented as not suitable for production by the psycopg2 maintainers
- Fix direction: Split into `requirements/base.txt`, `requirements/dev.txt`, `requirements/prod.txt`; use `psycopg2` (source) in prod
- Effort: S

### [MEDIUM] No OCI-specific networking documented
- Where: Project root (no `docs/` directory, no deployment README)
- Issue: OCI VCN, Security Lists, Load Balancer, and DNS configuration is entirely absent. No documentation exists for deploying this multi-service app to OCI.
- Impact: Deployment requires the operator to configure all networking from scratch with no guidance; risk of misconfiguration (e.g., DB exposed to internet)
- Fix direction: Create `docs/deployment/oci-setup.md` covering VCN subnet, Security List rules, LB config, DNS, and environment variables
- Effort: M

### [LOW] `docker-compose.yml` version field deprecated
- Where: `docker-compose.yml:1`
- Issue: `version: '3.8'` is deprecated in Docker Compose v2+. Modern `docker compose` (no hyphen) ignores this field and emits a warning.
- Impact: Minor — deprecation warning on `docker compose up`; no functional impact
- Fix direction: Remove the `version:` line
- Effort: XS
