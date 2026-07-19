# R0 — Baseline

**Status: DONE**
Analysis date: 2026-07-17

---

## Verified Feature Set (from code, not README)

### Framework Versions (from `requirements.txt` / `package.json`)
| Component | Version | Status |
|-----------|---------|--------|
| Django | 5.2.11 | ✅ Latest stable |
| DRF | 3.16.1 | ✅ Current |
| SimpleJWT | 5.5.1 | ✅ Current |
| psycopg2-binary | 2.9.11 | ⚠️ Binary wheel — not recommended for production |
| livekit-api | 1.1.0 | ✅ Current |
| React | 19.2.0 | ✅ Latest |
| react-router-dom | 7.13.0 | ✅ React Router v7 |
| Vite | 6.3.0 | ✅ Latest |
| tailwindcss | 3.4.17 | ✅ v3 (stable) |
| livekit-client | 2.17.3 | ✅ Current |
| axios | 1.13.5 | ✅ Current |

### Apps / Modules Present
| App | Status | Key capability |
|-----|--------|---------------|
| `accounts` | ✅ Wired | Users, Profiles (6 roles), TeacherProfile (payroll fields) |
| `students` | ✅ Wired | Student, Attendance, Assignment, Submission, StudyMaterial |
| `live_session` | ✅ Wired | Room, SessionLog, LiveKit JWT generation |
| `payments` | ✅ Wired | Payment, 2Checkout webhook, manual ledger |
| `log` | ✅ Wired | SystemLog audit trail |
| `ai_bot` | ❌ Empty | Zero implementation, placeholder only |
| `config/celery_app.py.todo` | ❌ Not wired | Async queue: 0% implemented |
| `config/s3_storage.py.todo` | ❌ Not wired | File storage: 0% implemented |
| `config/sentry.py.todo` | ❌ Not wired | Error monitoring: 0% implemented |

### What Redis Is Actually Used For
- **Provisioned:** Yes (`docker-compose.yml` redis service)  
- **Configured as cache backend:** ❌ No — `settings.py` has no `CACHES` key; Django uses `LocMemCache` by default  
- **Used for sessions:** ❌ No — default DB-backed sessions  
- **Used for queues (Celery):** ❌ No — Celery is not installed  
- **Used for rate limiting:** ❌ No — no rate limiting exists  
- **Summary:** Redis is running in docker-compose and doing **nothing**

### Scheduling Model (verified)
- `Student.class_timing` is a free-text `CharField` e.g. `"5:00 PM - 6:00 PM"` — no DB-level scheduling, no timezone, no conflict detection
- `TeacherDashboard.jsx:83-87` groups students by this string for the visual schedule view — client-side grouping on a free-text field

### Curriculum Tracking (verified)
- Migration `0001_initial.py` had a `current_surah` field — it was **removed** in migration `0002`
- No Surah/Juz/Hifz model exists anywhere in the current codebase
- The only academic record is `Attendance` (present/absent/late/leave) and `Assignment` (title + description + grade)

### Notification System (verified)
- Zero SMTP, SendGrid, Twilio, Firebase, or push-notification integration in backend code
- WhatsApp "notification" is a frontend `window.open(wa.me/...)` link — no server-side delivery
- No email confirmation on user creation

### Test Coverage (verified)
- Every app has `tests.py` containing exactly: `from django.test import TestCase` + `# Create your tests here.`
- **Zero test cases** across all 5 apps
- No frontend test files (no `*.spec.*`, `*.test.*`, vitest, jest config)

### PWA / i18n / RTL (verified)
- No `manifest.json`, no `service-worker.js`, no workbox config — **not a PWA**
- No i18n library, no `dir="rtl"` usage, no Arabic string in any `.jsx` or `.js` file — **zero RTL support**
- `public/` contains only `vite.svg`

### Gamification (verified)
- Zero badge, streak, point, or leaderboard logic anywhere in frontend or backend
- Intentionally out of scope (not referenced in README)
