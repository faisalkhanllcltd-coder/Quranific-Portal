# R5 — Platform Maturity

**Status: DONE**
Analysis date: 2026-07-17

---

### [ADD] Error monitoring (Sentry or equivalent)
- Area: platform-maturity / observability
- Where: `config/sentry.py.todo` (placeholder, 0% implemented)
- Why: Zero error tracking in production. Unhandled exceptions produce Django 500 responses with details logged to stdout only — no alerting, no stack trace capture, no release tracking. `Settings.jsx:50` — `catch(err) { console.error(err) }` leaks errors only to the browser console.
- Business impact: A production crash is undetectable until a user reports it. For a live class platform with children, silent failures are unacceptable — a student who cannot join a class and gets no error feedback will disengage permanently.
- Effort: S
- Priority: LAUNCH-BLOCKING

### [ADD] Structured logging with request IDs
- Area: platform-maturity / observability
- Where: `config/settings.py` — no `LOGGING` config. Python's root logger is used ad hoc via `logging.getLogger(__name__)` in each view.
- Why: Log messages like `"LiveKit Secure Token Issued: user=ali room=class-abc role=teacher"` are useful locally but structureless in production. Without a JSON log formatter, correlation of request → error → user action is impossible in any log aggregation system (OCI Logging, Datadog, etc.).
- Business impact: Debugging production issues requires correlating unstructured text lines across multiple files — hours of developer time per incident.
- Effort: S
- Priority: LAUNCH-BLOCKING

### [ADD] Test suite — zero tests across all 5 apps
- Area: platform-maturity / quality
- Where: All `tests.py` files contain only `from django.test import TestCase` + placeholder comment. Zero frontend tests.
- Why: No test coverage means every code change is a manual regression risk. The audit identified 12 CRITICAL bugs — none of them were caught by automated tests because none exist. RBAC logic (the most complex and security-critical part) has zero coverage.
- Business impact: Each deployment is a live experiment on paying customers' children's data. Regression in the payment flow or authentication system can cause revenue loss or data exposure with no automated detection.
- Effort: M (minimum viable test suite for auth, RBAC, payments, attendance) / L (full coverage)
- Priority: LAUNCH-BLOCKING

### [ADD] Email verification on user registration
- Area: platform-maturity / auth-maturity
- Where: `accounts/views.py:110-155` — user creation does `User.objects.create_user(...)` with no email verification step. Confirmed: no email verification code anywhere in codebase.
- Why: Parent accounts created during student enrollment have no email verification. A typo in the guardian email means the parent never receives payment receipts or alerts, and the account cannot be recovered via password reset (there is no password reset either — see next finding).
- Business impact: Unverified emails mean the payment notification loop is broken from day one for any parent with a typo in their address.
- Effort: M
- Priority: FAST-FOLLOW

### [ADD] Password reset / forgot password flow
- Area: platform-maturity / auth-maturity
- Where: N/A — entirely absent. No `PasswordResetView`, no email reset token, no reset UI. `Settings.jsx` has a password change form for authenticated users but no unauthenticated reset path.
- Why: A student or parent who forgets their password has no self-service recovery path. They must contact the academy admin, who must use `reset_pw.py` or the Django admin panel — both are manual, error-prone operations.
- Business impact: Every forgotten password = support ticket. At 100 students, password resets consume non-trivial admin time and create churn risk for impatient parents.
- Effort: M
- Priority: FAST-FOLLOW

### [ADD] Support / admin "login-as-user" tooling with audit trail
- Area: platform-maturity / support
- Where: N/A — no impersonation capability exists
- Why: When a parent reports "I can't see my child's attendance," the admin's only option is to ask for a screenshot or manually inspect the DB. `django-hijack` or equivalent would allow the owner to log in as any user to reproduce reported issues without sharing passwords — with an automatic audit log entry.
- Business impact: Reduces support resolution time from hours (manual DB inspection) to minutes. Also provides the audit trail needed to prove no data was accessed inappropriately.
- Effort: S (add `django-hijack` with audit logging)
- Priority: FAST-FOLLOW

---

### [IMPROVE] 2FA / Auth maturity — no second factor for owner or teacher accounts
- Area: platform-maturity / auth-maturity
- Where: `config/settings.py:175-183` — SimpleJWT config; no MFA in INSTALLED_APPS
- Why: The owner account controls payroll, student data, and all system access. There is no second factor. A phished owner password = complete platform takeover. For a platform handling children's data and payment records, TOTP 2FA for privileged roles is a reasonable minimum bar.
- Business impact: Single-factor auth for admin accounts is a compliance and trust issue for parents enrolling their children.
- Effort: M (add `django-otp` or `django-mfa2` for owner/head_manager roles)
- Priority: FAST-FOLLOW

### [IMPROVE] PWA installability — entirely absent
- Area: platform-maturity / UX
- Where: `frontend/public/` contains only `vite.svg`. No `manifest.json`, no service worker.
- Why: The platform's primary mobile use case is students joining live classes from a phone. A non-installable web app requires navigating to a URL every time. PWA install prompt eliminates this friction and provides an app-like home screen icon — critical for children who don't remember URLs.
- Business impact: Mobile session completion rate improves when students can launch from a home screen icon. PWA also enables offline caching of assignment descriptions for low-connectivity use cases.
- Effort: M
- Priority: FAST-FOLLOW

### [IMPROVE] API versioning strategy — no `/v1/` prefix, no versioning scheme
- Area: platform-maturity / architecture
- Where: `config/urls.py` — all routes are unprefixed e.g. `api/students/`, `api/live/token/`
- Why: This is acceptable pre-launch. Post-launch, when parent mobile apps, teacher integrations, or WhatsApp bots start consuming the API, any breaking change becomes a deployment coordination problem. No versioning now = migration pain later.
- Business impact: Retrofitting versioning after external integrations exist requires a coordinated breaking change across all consumers.
- Effort: S (add `/api/v1/` prefix now; zero-breaking-change if done before any external integrations)
- Priority: FAST-FOLLOW

### [IMPROVE] Tailwind design system — ad-hoc utility strings, no component library
- Area: platform-maturity / maintainability
- Where: Every `.jsx` file — Tailwind classes are inlined directly in JSX with no shared component abstractions. E.g. the same button style `"px-4 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl shadow-sm hover:bg-emerald-700..."` is duplicated across `StudentList.jsx`, `Assignments.jsx`, `Staff.jsx`, `Library.jsx`.
- Why: No shared `Button`, `Card`, `Badge`, `Modal` component exists. Style inconsistencies accumulate as features are added. A color change (e.g., brand color update from emerald to teal) requires finding and updating hundreds of inline class strings.
- Business impact: Development velocity decreases as the codebase grows. UI inconsistencies erode the premium feel of the product. Design changes become expensive engineering work.
- Effort: M
- Priority: FAST-FOLLOW
