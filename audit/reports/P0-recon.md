# P0 — Recon & Inventory

**Status: DONE**
Audit date: 2026-07-17

---

## App Map

### Django Apps → Models → Serializers → Views → URLs

| App | Models | Serializer | ViewSet/View | Prefix |
|-----|--------|-----------|-------------|--------|
| `accounts` | `Profile`, `TeacherProfile` | `UserSerializer`, `ProfileSerializer`, `TeacherListSerializer`, `RegisterSerializer`, `CustomTokenObtainPairSerializer` | `CustomTokenObtainPairView`, `RegisterView`, `ParentRegistrationView`, `MyProfileView`, `ChangePasswordView`, `PayrollViewSet`, `TeacherViewSet`, `SystemAccessViewSet` | `/api/accounts/` |
| `students` | `Student`, `Attendance`, `Assignment`, `Submission`, `StudyMaterial` (all extend `SoftDeleteModel`) | `StudentSerializer`, `AttendanceSerializer`, `AssignmentSerializer`, `SubmissionSerializer`, `StudyMaterialSerializer` | `StudentViewSet`, `AttendanceViewSet`, `AssignmentViewSet`, `SubmissionViewSet`, `StudyMaterialViewSet` | `/api/students/`, `/api/attendance/`, `/api/assignments/`, `/api/submissions/`, `/api/materials/` |
| `log` | `SystemLog` | `SystemLogSerializer` | `SystemLogViewSet` (ReadOnly) | `/api/logs/` |
| `live_session` | `Room`, `SessionLog` | _(none — views build dicts manually)_ | `GenerateTokenView`, `EndSessionView`, `LiveKitWebhookView`, `CreateDynamicRoomView` | `/api/live/` |
| `payments` | `Payment` | _(none — views build dicts manually)_ | `PaymentListView`, `twocheckout_webhook` (function view) | `/api/payments/` |

### React Routes → Pages → Key API Calls

| Route | Page | API Calls Made |
|-------|------|---------------|
| `/login` | `Login.jsx` | `POST /api/accounts/login/` |
| `/dashboard` | `Dashboard.jsx` → role-switches to `OwnerDashboard`, `TeacherDashboard`, `StudentDashboard`, `ParentDashboard` | Multiple via sub-dashboards |
| `/students` `/all-students` | `StudentList.jsx` | `GET /api/students/`, `GET /api/accounts/teachers/`, `GET /api/accounts/?profile__user_type=parent` (unverified — see P3) |
| `/students/:id` | `StudentProfile.jsx` | `GET /api/students/:id/` |
| `/staff` | `Staff.jsx` | `GET /api/accounts/teachers/` |
| `/staff/:id` | `TeacherProfile.jsx` | `GET /api/accounts/teachers/:id/` |
| `/attendance` | `Attendance.jsx` | `GET /api/attendance/`, `POST /api/attendance/bulk_mark/` |
| `/assignments` | `Assignments.jsx` | `GET /api/assignments/`, `GET /api/students/` |
| `/library` | `Library.jsx` | `GET /api/materials/`, `GET /api/students/` |
| `/admin` | `AdminHub.jsx` | `GET /api/logs/`, `GET /api/accounts/system-access/`, `GET /api/students/vault/`, `GET /api/students/` |
| `/finance` | `FinanceHub.jsx` | `GET /api/payments/`, `GET /api/accounts/payroll/`, `POST /api/payments/` |
| `/analytics` | `Analytics.jsx` | `GET /api/students/`, `GET /api/accounts/teachers/`, `GET /api/payments/` |
| `/settings` | `Settings.jsx` | `GET /api/accounts/me/`, `PATCH /api/accounts/me/`, `POST /api/accounts/change-password/` |
| `/classroom/:roomName` | `Classroom.jsx` | `POST /api/live/token/`, `POST /api/live/create-room/` |

---

## README Feature Claims vs Reality

| Claimed Feature | Actual State |
|-----------------|-------------|
| Role-Based Access Control | ✅ Exists — backend permissions + frontend RoleRoute |
| Live Virtual Classrooms (WebRTC) | ✅ Exists — LiveKit integrated |
| Student & Staff Management (CRUD) | ✅ Exists |
| Financial Operations / Payroll | ✅ Payroll exists; 2Checkout webhook present (not Stripe despite README env-var table mentioning Stripe) |
| Attendance Tracking | ✅ Exists |
| Audit Logging (Immutable) | ⚠️ Exists but NOT immutable — no DB-level delete protection |
| CI/CD Workflows | ❌ `.github/workflows/ci-cd-pipeline.yml.todo` — placeholder, never runs |
| AI Watchdog (OpenAI) | ❌ `ai_bot/` directory is completely empty |
| `parent` portal | ⚠️ Partial — data isolation coded, no dedicated parent route in `App.jsx` |

---

## Repo-Wide Smell Grep Results

### Backend App Code (excluding venv/third-party)

| File | Line | Pattern | Notes |
|------|------|---------|-------|
| `backend/reset_pw.py` | 15,19,21 | `print(` | Dev script; `print()` leaks to logs if run in prod |
| No app `.py` files | — | `TODO/FIXME/XXX/HACK` | None found in app source |
| No app `.py` files | — | `NotImplementedError` | None found in app source |
| No app `.py` files | — | bare `except:` | None found in app source |
| `config/settings.py` | 34 | Hardcoded insecure key | `'django-insecure-local-dev-key-only-do-not-use-in-prod'` — gated by `DEBUG` check |
| `config/settings.py` | 105 | `'postgres'` default password | Falls through from env; accepted silently in prod if env not set |
| `api.js` | 4, 83 | `127.0.0.1` | **Hardcoded** localhost URL — will break in prod |

### Frontend

| File | Lines | Pattern |
|------|-------|---------|
| `ErrorBoundary.jsx` | 24–25 | `console.error` — acceptable (error boundary) |
| 18 other `.jsx` files | various | `console.error` in catch blocks — low risk but will leak technical details in browser devtools |
| No files | — | `dangerouslySetInnerHTML` — none found |
| No files | — | `debugger` — none found |

---

## Models Without `__str__` / Missing FK Indexes

| Model | `__str__` | Notes |
|-------|-----------|-------|
| `Profile` | ✅ | |
| `TeacherProfile` | ✅ | |
| `Student` | ✅ | |
| `Attendance` | ✅ | FK on `student` — cascade, indexed by Django default |
| `Assignment` | ✅ | |
| `Submission` | ✅ | |
| `StudyMaterial` | ✅ | |
| `SystemLog` | ✅ | |
| `Room` | ✅ | |
| `SessionLog` | ✅ | |
| `Payment` | ✅ | No index on `student` FK or `month_paid_for` — financial queries will table-scan at scale |

## `Student.assigned_teacher` Design Debt

`assigned_teacher` is a plain `CharField(max_length=200)` — it stores a username string, not a FK to `User`. Lookups are `__iexact` string matches. This means:
- No referential integrity (rename a teacher user → all assignments orphaned silently)
- No DB-level join; requires ORM-level string comparison
- Payroll engine uses the same loose string matching

---

## Findings

### [HIGH] Hardcoded API base URL in frontend
- Where: `frontend/src/api.js:4` and `api.js:83`
- Issue: `baseURL: 'http://127.0.0.1:8000/api'` and raw `axios.post('http://127.0.0.1:8000/api/accounts/login/refresh/', …)` are hardcoded, not driven by `import.meta.env`
- Impact: Prod frontend will call localhost instead of the OCI server; every API call fails silently
- Fix direction: Replace with `import.meta.env.VITE_API_URL` and add `VITE_API_URL` to `.env.example`
- Effort: S

### [HIGH] CI/CD pipeline is a placeholder (`.todo` extension)
- Where: `.github/workflows/ci-cd-pipeline.yml.todo`
- Issue: File is never processed by GitHub Actions — zero automated testing on push
- Impact: Regressions ship undetected; OCI deployment has no quality gate
- Fix direction: Rename to `.yml`, fill with lint + migrate-check + pytest steps
- Effort: M

### [MEDIUM] `DJANGO_ALLOWED_HOSTS=*` committed in `.env`
- Where: `.env:12`
- Issue: The live `.env` file (committed to disk, not just `.env.example`) ships `ALLOWED_HOSTS=*` and `DEBUG=True`
- Impact: If this file is accidentally deployed as-is, host-header injection attacks become possible
- Fix direction: `.env` should not be committed; gate via `.env.example` only; add `.env` to `.gitignore` check
- Effort: S

### [MEDIUM] `POSTGRES_PASSWORD=postgres` in shipped `.env`
- Where: `.env:17`
- Issue: Trivial credential in the actual `.env` file (not just `.env.example`)
- Impact: If `.env` reaches any shared environment, database is open to dictionary attack
- Fix direction: Generate a strong password; use OCI Vault for injection
- Effort: S

### [MEDIUM] `LIVEKIT_API_KEY=devkey` / `LIVEKIT_API_SECRET=secret` in `.env`
- Where: `.env:26–27`
- Issue: LiveKit dev credentials in the deployed `.env`; any bearer of these can mint unlimited room tokens
- Impact: Students could fabricate teacher-level tokens externally
- Fix direction: Rotate to strong random values for prod; use OCI Vault
- Effort: S

### [MEDIUM] Redis provisioned but never used by application code
- Where: `docker-compose.yml:25–37`, `requirements.txt` (no `django-redis` / `celery`)
- Issue: Redis is running but `settings.py` has no `CACHES` config, no `django-redis`, no `celery`; README says "Session cache, future async tasks"
- Impact: Redis is pure cost with zero value; sessions use default DB backend; claimed caching benefit is fiction
- Fix direction: Either wire `django-redis` as cache backend or remove from compose and README
- Effort: S

### [MEDIUM] `Student.assigned_teacher` is a plain string, not a FK
- Where: `students/models.py:81`
- Issue: Teacher assignments stored as username string with no referential integrity
- Impact: Renaming a teacher's username silently orphans all their students and breaks payroll calculation; no DB index on this column
- Fix direction: Migrate to `ForeignKey(User, …)` or at minimum add `db_index=True`
- Effort: L

### [LOW] `reset_pw.py` in backend root with `print()` calls
- Where: `backend/reset_pw.py:15,19,21`
- Issue: Dev utility script with `print()` left in repo root; could be invoked accidentally in prod
- Impact: Minimal but adds noise to logs; script creates/overwrites a hardcoded `quranific` superuser — risk if run in prod
- Fix direction: Move to `management/commands/` or add a guard; remove `print()`
- Effort: S

### [LOW] `config/celery_app.py.todo`, `s3_storage.py.todo`, `sentry.py.todo`
- Where: `backend/config/`
- Issue: Three `.todo` stub files exist — Celery, S3 storage, Sentry never implemented
- Impact: Missing async task queue, missing OCI object storage integration, missing error monitoring
- Fix direction: Implement or remove; not blocking P0 but critical for P7
- Effort: L

### [INCOMPLETE] `ai_bot/` directory is empty
- Where: `ai_bot/`
- Issue: Directory exists, README references it, no files inside
- Impact: OpenAI watchdog feature is zero percent implemented
- Fix direction: Either remove from README or implement
- Effort: L

### [INCOMPLETE] CI/CD pipeline — see HIGH finding above
### [INCOMPLETE] `parent` role has no dedicated React route
- Where: `frontend/src/App.jsx` — no route for `/parent-dashboard` or similar
- Issue: Parent users land on `/dashboard` which renders `ParentDashboard` sub-component; that works, but there is no parent-specific sidebar or navigation distinct from student navigation
- Impact: UX confusion; parents sharing navigation items with students that may not apply
- Fix direction: Not necessarily a bug — acceptable if `Layout.jsx` handles it; verify in P4/P5
- Effort: M
