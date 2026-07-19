# R3 — Scalability & Architecture

**Status: DONE**
Analysis date: 2026-07-17

---

### [ADD] Celery + Redis task queue for async operations
- Area: architecture
- Where: N/A — `config/celery_app.py.todo` is a placeholder; Celery is not installed (`requirements.txt` has no `celery`)
- Why: All operations are synchronous, including: manual payment creation (DB write in request thread), 2Checkout webhook processing (DB write in webhook handler — slow = 2Checkout retries = duplicate payment risk), payroll calculation (iterates all teachers + students in a single request). Under concurrent load, these operations block gunicorn workers.
- Business impact: Each blocked worker = degraded response time for all other users. Webhook retry storm from 2Checkout can cause duplicate payment entries. Payroll run can time out for academies with 50+ teachers.
- Effort: M
- Priority: LAUNCH-BLOCKING

### [ADD] DB connection pooling via `CONN_MAX_AGE` or PgBouncer
- Area: scalability
- Where: `config/settings.py:100-108` — `DATABASES` has no `CONN_MAX_AGE` key
- Why: Every request opens a new PostgreSQL connection (TCP handshake + auth). Django default is `CONN_MAX_AGE=0` (connection-per-request). At 10 concurrent users hitting the dashboard (which fires 4 API calls each), that's 40 new connections per second. PostgreSQL's default `max_connections=100` will be exhausted.
- Business impact: Connection exhaustion → HTTP 500 cascade for all users simultaneously. OCI PostgreSQL free tier has hard connection limits.
- Effort: S (add `CONN_MAX_AGE=60` to settings; M to add PgBouncer sidecar)
- Priority: LAUNCH-BLOCKING

### [ADD] Django Channels / WebSocket layer for real-time notifications
- Area: architecture
- Where: N/A — confirmed zero WebSocket usage outside of LiveKit (video). No `channels`, `daphne`, or `uvicorn` installed.
- Why: Notification delivery currently requires the user to reload the page. Payment confirmations, session start alerts, and attendance submissions have no live-push path. The platform relies entirely on the user polling — or the admin remembering to send a WhatsApp.
- Business impact: Real-time notification is table-stakes for a live class platform where students need instant join-class alerts.
- Effort: L
- Priority: FAST-FOLLOW

### [ADD] Idempotency keys on payment POST and payroll run
- Area: architecture / reliability
- Where: `payments/views.py:64-111` (`PaymentListView.post`), `accounts/views.py:212+` (payroll engine)
- Why: Manual payment POST has no idempotency key. Double-click or network retry creates two payment records for the same student/month. Payroll endpoint (if triggered twice) runs the calculation twice. `transaction.atomic()` prevents partial writes but doesn't prevent duplicate submissions.
- Business impact: Double-charged student records damage trust and require manual correction. Payroll double-run overpays teachers.
- Effort: S (add `transaction_id` uniqueness check — partially done for 2Checkout; extend to manual payments)
- Priority: LAUNCH-BLOCKING

### [ADD] Zero-downtime migration strategy
- Area: architecture / DevOps
- Where: N/A — no deployment documentation
- Why: Django migrations lock tables during `ALTER TABLE` operations. At launch, migrations will run against a live database. The `Student` table will grow; adding columns without `null=True` or `default=` will lock the table. No `pg_repack`, no `django-pg-zero-downtime-migrations`, no documented migration protocol.
- Business impact: Schema migration on a 10,000-row Student table can lock the table for minutes, causing 500 errors for all users during the migration window.
- Effort: M
- Priority: FAST-FOLLOW

---

### [IMPROVE] Redis: wire as Django cache backend
- Area: scalability
- Where: `config/settings.py` — no `CACHES` config; Redis is running (`docker-compose.yml:25-37`) but unused
- Why: Zero caching. Every analytics request, every teacher list, every dashboard summary hits PostgreSQL. The Redis container consumes memory and does nothing.
- Business impact: 10-50ms saved per cache hit on frequently-accessed endpoints (student count, attendance summary, payroll totals). At 100 concurrent users, eliminating redundant DB queries is the single largest latency reduction available with near-zero effort.
- Effort: S
- Priority: LAUNCH-BLOCKING

### [IMPROVE] Stateless app server readiness — verify no local-memory session state
- Area: architecture
- Where: `config/settings.py:167-168` — DRF uses `JWTAuthentication` (stateless). But `django.contrib.sessions.middleware.SessionMiddleware` is installed with no configured session backend.
- Why: If sessions use the default DB backend and any code stores session state, running 2 gunicorn workers will create session stickiness requirements. JWT-based auth is stateless, but session middleware being present is a risk flag.
- Business impact: Non-stateless app servers cannot be load-balanced without session affinity, which complicates OCI deployment.
- Effort: S (verify no session writes; or configure Redis session backend explicitly)
- Priority: FAST-FOLLOW

### [IMPROVE] LiveKit config — `devkey:secret` hardcoded in `livekit.yaml`, no TURN server, `use_external_ip: false`
- Area: architecture / security
- Where: `livekit/livekit.yaml:8-9` — `keys: devkey: secret`; `use_external_ip: false`
- Why: Default LiveKit dev credentials. `use_external_ip: false` means the SFU reports its internal Docker IP to participants — connections will fail for clients outside the local network. No TURN server configured, which is required for firewalled networks (school networks, corporate VPNs — exactly where students connect from). Single LiveKit instance has no SFU redundancy.
- Business impact: LiveKit will fail to connect for a significant percentage of students connecting from school/home routers with strict NAT. Core feature (live class) broken for a material fraction of users.
- Effort: M
- Priority: LAUNCH-BLOCKING

### [IMPROVE] Missing composite DB indexes on high-traffic query paths
- Area: scalability
- Where: `students/models.py`, `payments/models.py`
- Why: `Attendance` queries filter on `student + date` (unique_together — indexed ✅). But `Student` queries filter on `assigned_teacher` (a `CharField` — no index), `status` (no index), `parent_account` (FK — Django auto-indexes FKs ✅). Attendance summary queries do `WHERE date >= X AND student_id IN (...)` — no composite index on `(student, date)` beyond the unique constraint.
  `Payment.objects.filter(student__parent_account=request.user)` traverses Student FK + filters — no index on `Student.parent_account` lookup path via payment.
  `SystemLog` has no indexed `timestamp` or `user` columns — audit log queries will full-scan as log grows.
- Business impact: Query degradation begins around 10,000 attendance rows (expected within 6 months of operation at 100 students × 250 school days).
- Effort: S
- Priority: FAST-FOLLOW

### [IMPROVE] `SessionLog.participant_count` race condition — increment without lock
- Area: architecture / reliability
- Where: `live_session/views.py:232-235`
- Why: `active_session.participant_count += 1; active_session.save(update_fields=['participant_count'])` — this is a read-modify-write without a DB-level lock. If two participants join simultaneously (common), both webhooks read `count=0`, both add 1, both write `count=1`. Final count is 1 instead of 2. Should be `F('participant_count') + 1`.
- Business impact: Session analytics and payroll-per-student calculations based on `participant_count` will undercount concurrent joins.
- Effort: XS
- Priority: FAST-FOLLOW

### [IMPROVE] `PaymentListView.get()` — no pagination on global ledger
- Area: scalability
- Where: `payments/views.py:39` — `Payment.objects.select_related('student').all().order_by('-date_paid')` — DRF global pagination is set to `PAGE_SIZE=50` but this view manually serializes to a list and returns `Response(data)` — it bypasses DRF's pagination class entirely.
- Why: At 12 payments/student × 100 students × 12 months = 14,400 payment records returned in a single JSON response.
- Business impact: FinanceHub will become progressively slower as the payment history grows; OOM risk on the API server for large academies.
- Effort: S
- Priority: FAST-FOLLOW
