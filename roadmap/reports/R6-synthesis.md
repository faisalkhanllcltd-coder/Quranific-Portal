# R6 — Synthesis: Prioritized Backlog

**Status: DONE**
Analysis date: 2026-07-17
Source: R0–R5 roadmap reports + audit reports P0–P8

---

## Prioritized Backlog

### NOW — Launch-Blocking (must ship before accepting real users / payments)

| # | Bucket | Finding | Phase | Effort | Overlaps Audit? |
|---|--------|---------|-------|--------|-----------------|
| 1 | IMPROVE | Wire `CONN_MAX_AGE=60` + Redis cache backend | R3 | S | P6 — DB pooling |
| 2 | IMPROVE | Fix N+1: `prefetch_related` on `StudentViewSet` + split list/detail serializer | R3/R4 | S | P2/P6 CRITICAL |
| 3 | ADD | Celery + Redis queue (async webhooks, email) | R3 | M | P4 — celery.todo |
| 4 | REMOVE | Delete `backend/node_modules/`, `backend/package.json` | R2 | XS | — |
| 5 | REMOVE | Delete `reset_pw.py` (hardcoded superuser credentials) | R2 | XS | P1 security |
| 6 | REMOVE | Delete `ai_bot/` + `.env` `OPENAI_API_KEY` placeholder | R2 | XS | P4 incomplete |
| 7 | REMOVE | Rename `.github/workflows/ci-cd-pipeline.yml.todo` → `.yml` and implement | R2 | XS+M | P4 — CI dead |
| 8 | ADD | Sentry error monitoring | R5 | S | P4 — sentry.todo |
| 9 | ADD | Structured logging with `LOGGING` config + request IDs | R5 | S | — |
| 10 | ADD | Email verification on user creation | R5 | M | — |
| 11 | IMPROVE | LiveKit: remove `--dev` flag, set `use_external_ip: true`, configure TURN | R3 | M | P7 — LiveKit dev |
| 12 | ADD | Test suite: auth, RBAC, payment, attendance (minimum viable) | R5 | M | P4 — zero tests |
| 13 | ADD | Quran curriculum / Hifz progress model | R1 | M | — |
| 14 | ADD | Structured class scheduling model (replace free-text `class_timing`) | R1 | M | — |
| 15 | ADD | Server-side notification delivery (email at minimum — SendGrid or Mailgun) | R1 | M | — |
| 16 | ADD | Idempotency on manual payment POST (prevent double-submit) | R3 | S | P2 — payment dedup |

> **Note:** Items 1–12 are also documented as CRITICAL/HIGH in the audit (`audit/reports/`). The fix set overlaps — implement once, close both backlogs.

---

### NEXT — Fast-Follow (first 60 days post-launch)

| # | Bucket | Finding | Phase | Effort |
|---|--------|---------|-------|--------|
| 17 | ADD | Password reset / forgot password flow | R5 | M |
| 18 | ADD | Admissions / trial-class public intake form | R1 | L |
| 19 | ADD | Certificate / progress report PDF generation | R1 | M |
| 20 | ADD | Admin "login-as-user" with audit trail (`django-hijack`) | R5 | S |
| 21 | ADD | Multi-currency + invoice PDF on payment | R1 | M |
| 22 | IMPROVE | Parent portal — add assignments, grades, teacher contact | R1 | M |
| 23 | IMPROVE | Guardian assignment grade — standardized scale (not free-text) | R1 | S |
| 24 | IMPROVE | PWA: add `manifest.json` + service worker | R5 | M |
| 25 | IMPROVE | API versioning — add `/api/v1/` prefix | R5 | S |
| 26 | IMPROVE | React Query / SWR for frontend data caching + deduplication | R4 | M |
| 27 | IMPROVE | `SystemLog` server-side pagination + date/user filter | R4 | S |
| 28 | IMPROVE | Split `StudentSerializer` into list vs. detail serializer | R4 | S |
| 29 | IMPROVE | `PaymentListView` — add DRF pagination (bypasses global) | R3 | S |
| 30 | IMPROVE | Composite DB indexes: `Student.assigned_teacher`, `SystemLog.timestamp` | R3 | S |
| 31 | IMPROVE | Fix `SessionLog.participant_count` race — use `F('participant_count') + 1` | R3 | XS |
| 32 | REMOVE | Remove `RecoveryVault.jsx` (dead page — replaced by AdminHub tab) | R2 | XS |
| 33 | REMOVE | Remove duplicate `/all-students` route | R2 | XS |
| 34 | IMPROVE | Session backend: explicitly configure Redis sessions or remove middleware | R3 | S |
| 35 | ADD | In-platform messaging (teacher ↔ student ↔ guardian) | R1 | L |
| 36 | ADD | CDN for static assets (OCI CDN or Cloudflare) | R4 | M |
| 37 | IMPROVE | 2FA for owner/head_manager roles (`django-otp`) | R5 | M |

---

### LATER — Roadmap (post 60-day stabilization)

| # | Bucket | Finding | Phase | Effort |
|---|--------|---------|-------|--------|
| 38 | ADD | Class session recording (LiveKit egress → S3 → HLS playback) | R1 | L |
| 39 | ADD | i18n / RTL Arabic UI support | R1 | L |
| 40 | ADD | Gamification: streaks, badges, leaderboard | R1 | L |
| 41 | ADD | Django Channels WebSocket layer for real-time push | R3 | L |
| 42 | ADD | LiveKit edge multi-region (OCI multi-region or LiveKit Cloud) | R4 | L |
| 43 | ADD | Adaptive bitrate recording playback (HLS/DASH transcode pipeline) | R4 | L |
| 44 | IMPROVE | Tailwind design system — extract shared `Button`, `Card`, `Modal` components | R5 | M |
| 45 | IMPROVE | Zero-downtime migration strategy (`django-pg-zero-downtime-migrations`) | R3 | M |
| 46 | REMOVE | Clean `requirements.txt` to direct deps only (use `pip-compile` or `uv`) | R2 | S |

---

## The Three Highest-Leverage Moves

### #1 ADD — Quran Curriculum / Hifz Progress Tracker
**The single highest-leverage ADD.** The entire platform's raison d'être is teaching Quran memorization, and there is no data model for what a student has memorized. Without this, the platform is an attendance tracker + video conferencing tool. Adding Surah/Juz progress, revision scheduling, and per-student learning paths transforms it into an actual LMS — unlocking parent retention, progress report generation, certificate issuance, and AI-assisted revision scheduling in the future. Every other domain feature depends on having a curriculum data model.

### #2 REMOVE — Dead scaffolding + `reset_pw.py` hardcoded credentials
**The single highest-leverage REMOVE.** Five launch-blocking cleanup items (`ai_bot/`, three `.todo` configs, CI pipeline, `reset_pw.py` with hardcoded credentials, `node_modules` in backend) can all be removed in under 30 minutes combined. Each one is a security or operational risk that costs essentially nothing to eliminate. The `reset_pw.py` file alone contains a plaintext owner password in version control — this must be removed before any external contributor or deployment engineer sees the repository.

### #3 IMPROVE — N+1 query fix + connection pooling (combined)
**The single highest-leverage IMPROVE.** The `StudentSerializer` N+1 storm (`3N+2` queries per list request) combined with no DB connection pooling means the platform cannot handle more than ~5 concurrent users before response times degrade past 5 seconds. These two fixes together (`prefetch_related` + `CONN_MAX_AGE=60`) require < 20 lines of code and eliminate the primary scaling constraint. Every other performance investment (CDN, caching, Celery) is wasted if the database is being hit 1,208 times per page load with no connection reuse.

---

## Audit ↔ Roadmap Overlap Map

| Audit Finding | Audit Report | Roadmap Finding | Roadmap Phase | Single Fix? |
|--------------|--------------|-----------------|---------------|-------------|
| N+1 query storm | P2 CRITICAL | IMPROVE: prefetch_related + list serializer split | R3, R4 | ✅ One fix |
| No DB connection pool | P6 CRITICAL | IMPROVE: CONN_MAX_AGE + PgBouncer | R3 | ✅ One fix |
| api.js hardcoded localhost | P1/P3 CRITICAL | (Audit bug, not a roadmap gap — fix api.js) | — | ✅ Audit fix |
| No gunicorn | P7 CRITICAL | REMOVE: `.todo` configs → ADD proper Dockerfile | R2 | ✅ One fix |
| Celery.todo | P4 HIGH | ADD: Celery queue | R3 | ✅ One fix |
| Sentry.todo | P4 MEDIUM | ADD: Sentry monitoring | R5 | ✅ One fix |
| CI/CD dead (.todo) | P4 HIGH | REMOVE: rename + implement | R2 | ✅ One fix |
| reset_pw.py credentials | P4 MEDIUM | REMOVE: delete file | R2 | ✅ One fix |
| No rate limiting | P1 HIGH | (Audit security fix) + Celery enables async throttle | R3 partial | Partially shared |
| Payment float precision | P2 CRITICAL | (Pure audit fix — `Decimal()` not a roadmap gap) | — | Audit only |
| JWT blacklist | P1 CRITICAL | (Pure audit fix) | — | Audit only |
| WhatsApp link only notif | P5 MEDIUM | ADD: server-side email notifications | R1 | Roadmap extends |
| No pagination on payments | P3 HIGH | IMPROVE: add DRF pagination to PaymentListView | R3 | ✅ One fix |
| Teacher salary to students | P8 HIGH | IMPROVE: split serializer | R4 | ✅ One fix |
| SessionLog race condition | — | IMPROVE: use F() expression | R3 | Roadmap only |
| Zero tests | P4 HIGH | ADD: test suite | R5 | ✅ One fix |

**Implementation note:** Fix audit blockers first (they unblock production). Then tackle roadmap ADDs (they unlock growth). The shared items above need only ONE implementation — don't duplicate the work across two tracking systems.
