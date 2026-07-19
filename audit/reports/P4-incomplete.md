# P4 — Incomplete & Dead Code

**Status: DONE**
Audit date: 2026-07-17

---

## Findings

### [HIGH] `SystemAccessViewSet.list()` returns ALL user accounts to owner — includes student PIIs
- Where: `accounts/views.py:295-312`
- Issue: `users = User.objects.exclude(id=request.user.id)` returns EVERY user except the owner. This includes student accounts, their `username`, `email`, and `role`. This endpoint is called by `StudentList.jsx` to populate the parent dropdown, meaning the UI loads all student usernames + emails in the same request used to list parents.
- Impact: Not strictly "incomplete", but owner-only endpoint exposes all student PIIs in one un-paginated dump — PII exposure risk and performance concern; also called by `AdminHub.jsx:186` for the full user table. At 1000 users this is a single 1000-object response.
- Fix direction: Filter by role server-side for parent listings; paginate; separate parent-list endpoint from admin-user-list endpoint
- Effort: M

### [HIGH] `ai_bot/` directory is empty — OpenAI integration is 0% implemented
- Where: `ai_bot/` (empty directory)
- Issue: README describes an AI Watchdog / OpenAI integration. No files exist. `.env` has a placeholder `OPENAI_API_KEY=sk-xxxx...`
- Impact: Feature is fictionally described in production README; misleads stakeholders; `OPENAI_API_KEY` placeholder in `.env` will cause confusion
- Fix direction: Remove from README or implement; remove placeholder env var
- Effort: L

### [HIGH] CI/CD pipeline file has `.todo` extension — zero automated testing occurs
- Where: `.github/workflows/ci-cd-pipeline.yml.todo`
- Issue: GitHub Actions ignores files that don't end in `.yml`. No tests, no linting, no migration checks run on any PR or push.
- Impact: Every commit can ship broken migrations, failing tests (if any existed), or security regressions undetected
- Fix direction: Rename to `.yml`; implement: lint, test, `manage.py check --deploy`, `manage.py migrate --check`
- Effort: M

### [MEDIUM] `backend/config/celery_app.py.todo` — Celery not implemented
- Where: `backend/config/celery_app.py.todo`
- Issue: No Celery, no async task queue. All operations (including webhook handling) are synchronous. Redis is running but idle.
- Impact: Webhook response time includes all DB operations; if payment webhook processing is slow, 2Checkout may time out and retry. No background job framework for scheduled reports, email reminders, or session cleanup.
- Fix direction: Implement or explicitly drop from roadmap and remove Redis from docker-compose
- Effort: L

### [MEDIUM] `backend/config/s3_storage.py.todo` — No object storage
- Where: `backend/config/s3_storage.py.todo`
- Issue: No file storage configured. Any future file upload feature would use local disk by default, incompatible with multi-container OCI deployment. `StudyMaterial` model has a `link` field (URL string) not a `FileField` — this is a workaround, not a solution.
- Impact: No file upload capability; teachers cannot share actual PDFs/images, only external links. This limits LMS functionality.
- Fix direction: Implement OCI Object Storage integration (S3-compatible) if file uploads are required
- Effort: L

### [MEDIUM] `backend/config/sentry.py.todo` — No error monitoring
- Where: `backend/config/sentry.py.todo`
- Issue: No Sentry or equivalent error monitoring in production
- Impact: Unhandled exceptions in production will be silently logged (if logging is configured) or lost entirely; no alerting, no stack trace capture for debugging
- Fix direction: Implement Sentry DSN via env var; add 10 lines of standard Sentry Django setup
- Effort: S

### [MEDIUM] `reset_pw.py` is a dev utility in the project root with hardcoded superuser creation
- Where: `backend/reset_pw.py:19`
- Issue: Script creates a superuser named `quranific` with whatever password is provided on stdin. If accidentally run on the production DB, it silently creates or overwrites the owner account. No environment guard.
- Impact: Accidental production execution could reset the primary admin account
- Fix direction: Convert to a Django management command with a `--env dev` guard; add explicit confirmation prompt; move out of root directory
- Effort: S

### [LOW] Frontend `RoleRoute.jsx` has a dead default fallback
- Where: `frontend/src/components/RoleRoute.jsx:22`
- Issue: `localStorage.getItem('user_type') || 'student'` — if `user_type` is null (user is not logged in), the default `'student'` is used. But `RoleRoute` is documented as "always rendered INSIDE a ProtectedRoute" — meaning the user is guaranteed to be logged in. The fallback to `'student'` is dead code and might mask bugs.
- Impact: Low risk but creates false confidence; a student successfully bypasses a RoleRoute check if their `user_type` is somehow cleared from localStorage
- Fix direction: Remove the fallback or redirect to `/login` if `user_type` is null
- Effort: S

### [LOW] `students/views.py:RecoveryVaultMixin` — vault feature exists but has no UI
- Where: `students/views.py` (RecoveryVaultMixin), `AdminHub.jsx:186`
- Issue: `GET /api/students/vault/` endpoint exists for soft-deleted students. `AdminHub.jsx` calls it but only shows it in a debug card in the admin panel. No UI for restoring (un-deleting) students from vault.
- Impact: Vault recovery feature is inaccessible to users; soft-deleted students cannot be restored through the UI
- Fix direction: Add "Restore" action in AdminHub vault section; connect to `PATCH /api/students/:id/restore/` if that endpoint exists, or add one
- Effort: M
