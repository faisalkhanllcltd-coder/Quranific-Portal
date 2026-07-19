# R2 — What to Remove

**Status: DONE**
Analysis date: 2026-07-17

All entries verified against actual file contents and import graphs.

---

### [REMOVE] `ai_bot/` empty directory + `OPENAI_API_KEY` placeholder in `.env`
- Area: dead scaffolding / security
- Where: `ai_bot/` (empty dir), `.env:OPENAI_API_KEY=sk-xxxx...`
- Why: Zero lines of implementation. The placeholder API key pattern `sk-xxxx...` trains operators to keep placeholder secrets in `.env` files — a deployment risk. The empty directory implies a feature that doesn't exist.
- Business impact: Reduces operator confusion; eliminates false impression of AI capability to stakeholders reading the codebase.
- Effort: XS
- Priority: LAUNCH-BLOCKING

### [REMOVE] `backend/config/celery_app.py.todo`, `s3_storage.py.todo`, `sentry.py.todo`
- Area: dead scaffolding
- Where: `backend/config/` — three `.todo` files
- Why: These are abandoned scaffolding files with `.todo` extension. They are invisible to Python's import system and do nothing. They communicate future intent but create noise and false confidence in production readiness review.
- Business impact: Ops teams doing pre-deployment checks see these and assume features are implemented. Remove and track in GitHub Issues instead.
- Effort: XS
- Priority: LAUNCH-BLOCKING

### [REMOVE] `.github/workflows/ci-cd-pipeline.yml.todo` — dead CI file
- Area: dead scaffolding / platform-maturity
- Where: `.github/workflows/ci-cd-pipeline.yml.todo`
- Why: GitHub Actions ignores this file. The presence of a `.todo` extension creates the false impression of CI. Every commit is unguarded.
- Business impact: Zero automated quality gates means any commit can ship a broken migration or security regression.
- Effort: XS (rename to `.yml` — but enabling CI properly is M)
- Priority: LAUNCH-BLOCKING

### [REMOVE] `backend/reset_pw.py` — hardcoded dev utility in project root
- Area: dead scaffolding / security
- Where: `backend/reset_pw.py:18` — `User.objects.create_superuser(username="quranific", password="BROTHERfaisal.edu,123", ...)`
- Why: This file contains a hardcoded username and password literal for a superuser account. It lives in the project root with no production guard. Accidental execution against the production DB creates/resets the owner account silently. The hardcoded credentials are a repository secret exposure.
- Business impact: Accidental execution = owner account takeover. Hardcoded password in VCS = any contributor with repo access knows the owner password.
- Effort: XS (delete the file; replace with a `manage.py` command if needed)
- Priority: LAUNCH-BLOCKING

### [REMOVE] `backend/node_modules/` and `package.json` inside `backend/`
- Area: dead scaffolding / waste
- Where: `d:\Live Web\quranific-portal\backend\node_modules\` and `backend\package.json` (148 bytes)
- Why: There is no frontend code in the `backend/` directory. A `node_modules` directory inside the Django backend app directory is 100% dead weight — it either came from an accidental `npm install` in the wrong directory or was never cleaned up.
- Business impact: Adds noise to Docker image builds if not excluded via `.dockerignore`; misleads contributors about backend stack; `node_modules` inside the Python app directory will be included in any naive deployment.
- Effort: XS
- Priority: LAUNCH-BLOCKING

### [REMOVE] `aiohttp`, `aiohappyeyeballs`, `aiosignal`, `frozenlist`, `propcache` from `requirements.txt` — livekit-api transitive deps, check if direct use exists
- Area: dependency hygiene
- Where: `backend/requirements.txt`
- Why: These are async HTTP libraries pulled in as transitive dependencies of `livekit-api`. They are not directly imported anywhere in the project code (confirmed: no `import aiohttp` in any `.py` file outside `venv`). They bloat the Docker image and increase the attack surface. `pip freeze` captures them as top-level dependencies, which is a pip anti-pattern.
- Business impact: Smaller Docker image; cleaner dependency graph; fewer CVE exposure points.
- Effort: S (move to proper `pip-compile` / `uv` workflow that separates direct from transitive deps)
- Priority: FAST-FOLLOW

### [REMOVE] Duplicate `RecoveryVault.jsx` — functionality is merged into `AdminHub.jsx`
- Area: dead code / duplication
- Where: `frontend/src/pages/RecoveryVault.jsx` (15,621 bytes) and `AdminHub.jsx:370-375`
- Why: `App.jsx:99` redirects `/recovery-vault` → `/admin`. The `RecoveryVault.jsx` page exists as a standalone component (15KB) but is never routed to directly — it is dead from the router's perspective. `AdminHub.jsx` contains the same vault tab with identical restore logic (`AdminHub.jsx:370-375` vs `RecoveryVault.jsx:71-77`). Two copies of the same restore logic, one unreachable.
- Business impact: Dead code increases bundle size and maintenance burden; any bug fix must be applied twice.
- Effort: XS
- Priority: FAST-FOLLOW

### [REMOVE] Duplicate `/all-students` route pointing to same component as `/students`
- Area: dead code
- Where: `App.jsx:131-138` — `<Route path="/all-students" element={<RoleRoute ...><StudentList /></RoleRoute>} />`
- Why: Both `/students` and `/all-students` render the identical `StudentList` component with the same `RoleRoute` guard. There is no routing logic in `StudentList.jsx` that differentiates behavior based on the URL path. This is a legacy alias that was never cleaned up.
- Business impact: Confusing for developers maintaining the routing; link shortcuts could accidentally navigate to the wrong canonical URL.
- Effort: XS
- Priority: LATER
