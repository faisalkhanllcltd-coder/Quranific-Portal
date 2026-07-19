# Quranific Portal — Pending Human Actions

Tracks operator actions that code fixes cannot automate.
Update this file as each action is completed.

---

## Format

| ID | Related Fix | Priority | Status | Action Required | Completed |
|----|------------|----------|--------|-----------------|-----------|

---

## Actions

### 🔐 Credentials & Key Rotation

| ID | Related Fix | Priority | Status | Action Required | Completed |
|----|------------|----------|--------|-----------------|-----------|
| H-LK-01 | R-R3-05 | CRITICAL | **LOCAL DONE** | **Local LiveKit key rotation:** Generate real key pair (`openssl rand -hex 32` × 2), update `livekit/livekit.yaml` keys: section and `.env` `LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET` to match, restart LiveKit container, confirm CRITICAL log no longer fires. | 2026-07-18 — confirmed clean by operator |
| H-LK-02 | R-R3-05 | CRITICAL | **PENDING** | **OCI production LiveKit key pair:** Generate a *separate, different* key pair from the local one for the production OCI instance. Set in OCI `.env` (or OCI Vault secret) and in the production `livekit/livekit.yaml`. Never reuse local dev keys in production. | — |
| H-REDIS-01 | A-P7-06 | HIGH | **PENDING** | **Production Redis password:** Change `REDIS_PASSWORD=changeme_redis_password` in `.env` to a strong random value (`openssl rand -hex 24`) before OCI deploy. Update `REDIS_URL` to match. | — |
| H-POSTGRES-01 | A-P7-05 | HIGH | **PENDING** | **Production Postgres password:** Change `POSTGRES_PASSWORD=postgres` in `.env` to a strong value before OCI deploy. | — |
| H-DJANGO-01 | A-P7-02 | CRITICAL | **PENDING** | **Production Django secret key:** Change `DJANGO_SECRET_KEY=change-me-to-a-random-50-char-string` in `.env` to a 50+ char random string (`python -c "import secrets; print(secrets.token_urlsafe(50))"`) before OCI deploy. | — |
| H-LK-03 | R-R3-05 | HIGH | **PENDING** | **TURN server:** Set up Coturn on OCI (or managed TURN) and uncomment the `turn:` block in `livekit/livekit.yaml`. Open OCI Security List: UDP/TCP 3478, TLS 5349. | — |
| H-2CO-01 | A-P1-04 | HIGH | **PENDING** | **2Checkout credentials:** Replace `TWOCHECKOUT_VENDOR_ID=your_vendor_id_here` and `TWOCHECKOUT_SECRET_WORD=your_secret_word_here` in `.env` with real production values. Verify HMAC hash format in 2Checkout Merchant Control Panel. | — |

### 🚀 OCI Deploy Checklist

| ID | Related Fix | Priority | Status | Action Required | Completed |
|----|------------|----------|--------|-----------------|-----------|
| H-OCI-01 | A-P7-02 | CRITICAL | **PENDING** | Set `DJANGO_DEBUG=False`, explicit `DJANGO_ALLOWED_HOSTS`, `DJANGO_CORS_ALLOWED_ORIGINS` in OCI `.env`. | — |
| H-OCI-02 | A-P1-03 | HIGH | **PENDING** | Run `python manage.py migrate` on OCI — includes token_blacklist migrations (12 pending). | — |
| H-OCI-03 | A-P2-04 | HIGH | **PENDING** | Run `python manage.py migrate` — includes payment unique constraint migration `0003_add_unique_payment_per_student_per_month`. | — |
| H-OCI-04 | A-P7-04 | HIGH | **PENDING** | Run `docker compose build` then `docker compose up -d` after all credentials are set. Confirm CRITICAL LiveKit log does not appear in `docker compose logs live_session`. | — |
| H-OCI-05 | A-P4-03 | MEDIUM | **PENDING** | Add GitHub Actions secrets (`DJANGO_SECRET_KEY`, `LIVEKIT_API_KEY`, etc.) so the CI pipeline can run the backend job. | — |

### 🗑️ Manual Removals (if not done by code fix batch)

| ID | Related Fix | Priority | Status | Action Required | Completed |
|----|------------|----------|--------|-----------------|-----------|
| H-GIT-01 | A-P1-12 | LOW | **PENDING** | Check git history for any committed `.env` with real secrets: `git log --all --full-history -- .env`. If found, rewrite history with `git filter-repo`. | — |

### 🛠️ Local Dev Environment

| ID | Related Fix | Priority | Status | Action Required | Completed |
|----|------------|----------|--------|-----------------|-----------|
| H-DEV-01 | R-R5-04 | MEDIUM | **PENDING** | **Add docker-compose.override.yml to .gitignore once git repo is initialized.** The file was created at project root for local dev port-binding (db:5432, redis:6379) so pytest can reach Postgres from the Windows host. It is intentionally NOT committed. When `git init` / GitHub connect happens, ensure `.gitignore` includes `docker-compose.override.yml` so it is never accidentally pushed (A-P7-05 security hardening must stay intact in OCI). Current root `.gitignore` already has the entry — just confirm once git init runs. | — |
| H-DEV-02 | R-R5-04 | LOW | **DONE** | **WSL2 memory raised to 4GB.** Added `memory=4GB` under `[wsl2]` in `%USERPROFILE%\.wslconfig` to prevent Postgres OOM-kill during long pytest runs. `wsl --shutdown` and Docker Desktop restart applied. Confirmed `Total Memory: 3.825 GiB` in `docker info`. No further action needed unless memory pressure reappears. | 2026-07-18 |

---

## Notes

- Items marked **LOCAL DONE** are complete in the local dev environment but require a separate production action before OCI deploy.
- Items marked **PENDING** have not been acted on at all.
- This file is the single source of truth for operator-side actions. Update it whenever an action is completed.
