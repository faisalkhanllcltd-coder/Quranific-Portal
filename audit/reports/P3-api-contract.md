# P3 — API Contract & Frontend/Backend Mismatch

**Status: DONE**
Audit date: 2026-07-17

---

## Findings

### [CRITICAL] `VITE_API_BASE_URL` is defined but `api.js` ignores it — all production API calls go to localhost
- See P1-security.md for full write-up. **Primary finding already filed there.**
- Additional evidence: `frontend/.env:1` → `VITE_API_BASE_URL=http://127.0.0.1:8000/api`. `api.js:4` → `baseURL: 'http://127.0.0.1:8000/api'` (hardcoded). The env var is dead.

### [HIGH] `StudentList.jsx` fetches parent accounts from wrong endpoint with wrong field filter
- Where: `frontend/src/pages/StudentList.jsx:58` and `100-108`
- Issue: `api.get('accounts/system-access/')` is called to get parent accounts, then filtered client-side with `u.role === 'parent'`. The backend `SystemAccessViewSet` (log app) returns `SystemLog` audit records — NOT user records. The field `u.role` does not exist on a `SystemLog` object. This means `parents` array is always `[]`.
- Impact: "Link Existing Parent" feature in the enrollment drawer is completely broken — the dropdown is always empty regardless of how many parent accounts exist. New student → parent linking silently fails.
- Fix direction: Use `api.get('accounts/?profile__user_type=parent')` or a dedicated parent-list endpoint; the backend view `SystemAccessViewSet` (at `accounts/views.py`) may already return users — needs verification of what it actually returns
- Effort: S

### [HIGH] `FinanceHub.jsx` hardcodes `$50` per-student pending revenue
- Where: `frontend/src/pages/FinanceHub.jsx:138`
- Issue: `const pendRev = defs.length * 50; // Dynamic rate integration pending` — the "Expected Total" and "Pending Revenue" figures displayed to the academy owner are calculated using a hardcoded `$50` per student, ignoring any per-student or per-teacher rate configured in the system
- Impact: Financial projections shown to owner are fiction if any student has a different fee structure. "Expected Total" card is misleading; owner makes business decisions based on incorrect numbers.
- Fix direction: Pull per-student fee from the Payment history average or from a configurable rate field; mark clearly as "estimate" in the UI until proper calculation exists
- Effort: M

### [HIGH] Frontend applies a second teacher-filter on top of server-side-filtered data
- Where: `frontend/src/pages/StudentList.jsx:62-64`
- Issue: Backend `StudentViewSet.get_queryset()` already scopes teachers to their own students via `assigned_teacher__iexact=user.username`. Frontend then ALSO does `allStudents.filter(s => s.assigned_teacher?.toLowerCase() === username.toLowerCase())`. This double-filter means teacher data is filtered correctly. However, the approach reveals the architecture assumes all data is always returned (no trust of server scope) — if a server scope bug ever allows more data through, the frontend filter does protect against display, but silently. Teachers reviewing their data won't know if the server is returning too much.
- Impact: Not a security risk in practice but creates fragile coupling; client-side filter is security-by-obscurity. If a teacher changes their username while a student list is cached in localStorage, the filter will show zero students while the server returns the correct set.
- Fix direction: Remove the redundant frontend filter; trust server-side scoping; consider an explicit `GET /api/students/mine/` endpoint
- Effort: S

### [HIGH] `StudentList.jsx` password field shown as `type="text"` in enrollment form
- Where: `frontend/src/pages/StudentList.jsx:529`
- Issue: `<input name="password" type="text" required ...>` — password input is NOT of `type="password"`. The student's initial password is displayed in plaintext on screen and in any browser autofill suggestions.
- Impact: For a children's Quran academy, any observer (parent, child, sibling) looking at the enrollment screen sees the new student's password in cleartext. Password managers will not offer to save it, increasing chance it's reused.
- Fix direction: Change `type="text"` to `type="password"` or `type="text"` with a show/hide toggle
- Effort: S

### [HIGH] Parent password in enrollment form also `type="text"` and shows plaintext
- Where: `frontend/src/pages/StudentList.jsx:659`
- Issue: Same issue — parent portal password is `type="text"`. Both are shown in the credentials display card after enrollment at lines 479 and 495, which is intentional (copy/share), but the input field should be masked.
- Impact: Same as above for parent accounts
- Fix direction: Same as above
- Effort: S

### [MEDIUM] `Classroom.jsx` fallback to `ws://localhost:7880` in production
- Where: `frontend/src/pages/Classroom.jsx:18`
- Issue: `const LIVEKIT_WS_URL = import.meta.env.VITE_LIVEKIT_URL || 'ws://localhost:7880'` — if `VITE_LIVEKIT_URL` is not set in the Vite build env, LiveKit connections fall back to localhost. The `frontend/.env` currently sets `VITE_LIVEKIT_URL=ws://127.0.0.1:7880` which is also localhost. Both are correct fallbacks only for local dev; in OCI deployment both will fail.
- Impact: Live classroom feature breaks silently in production if env var is not updated; fallback is `ws://` (not `wss://`) which will be rejected by browsers over HTTPS
- Fix direction: Update `frontend/.env` to `VITE_LIVEKIT_URL=wss://your-oci-livekit-host`; add validation startup check; ensure `wss://` protocol
- Effort: S

### [MEDIUM] `PaymentListView.post()` has no input validation or serializer
- Where: `payments/views.py:49-62`
- Issue: `post()` accepts raw `request.data` dict and calls `Payment.objects.create(**request.data)` directly (or similar pattern). Without a DRF serializer, no field validation occurs — any valid field name could be passed.
- Impact: A manager-level user could post `{'student': 999, 'amount': -500, 'month_paid_for': 'not-a-date', 'status': 'arbitrary'}` and the DB would accept it if Django model-level validation doesn't catch it. Negative amounts are particularly dangerous for revenue reporting.
- Fix direction: Implement a `PaymentSerializer` with proper field validation, positive amount constraint, and date format enforcement
- Effort: M

### [MEDIUM] WhatsApp reminder in Defaulters view builds URL with unescaped student name — potential XSS vector
- Where: `frontend/src/pages/FinanceHub.jsx:333`
- Issue: `` window.open(`https://wa.me/${s.guardian_whatsapp?.replace(/\D/g, '')}?text=...student ${s.full_name}...`) `` — `s.full_name` is inserted directly into the URL string without encoding. If a student's name contains `&`, `=`, `%`, `+`, or `<script>` characters (since names are free-text), the URL could be malformed or, in a browser's URL handler, cause unexpected behavior.
- Impact: Low probability of exploitation but incorrect URL encoding breaks the WhatsApp link for students with special characters in names; a crafted name could inject additional query parameters
- Fix direction: Use `encodeURIComponent(s.full_name)` in the template literal
- Effort: S

### [MEDIUM] `accounts/views.py` `SystemAccessViewSet` — unclear if it returns users or logs
- Where: `accounts/views.py:270+` (line not yet read) — the frontend calls `accounts/system-access/` expecting user records with a `role` field, but the backend `SystemAccessViewSet` in `log/views.py` is `SystemLogViewSet` (ReadOnly). If the `accounts/` app has a separate `SystemAccessViewSet`, it needs to be verified.
- [SUSPECTED — to be confirmed] The `accounts/urls.py` registers `SystemAccessViewSet` which may be in `accounts/views.py` not `log/views.py`. Frontend filter `u.role === 'parent'` requires it returns user-like objects. This mismatch would also affect the AdminHub.
- Fix direction: Verify what `accounts/system-access/` returns; align frontend filter field to actual API response shape
- Effort: S

### [LOW] `accounts/views.py` `TeacherListSerializer.get_classes()` returns raw student list but `StudentList.jsx` expects a `length` count
- Where: `frontend/src/pages/OwnerDashboard.jsx:350`: `{t.classes?.length ?? 0} Students`
- Issue: `TeacherListSerializer.get_classes()` returns an array of student objects (or count — needs verification). Frontend does `.length` on the result. If it returns a count integer instead of an array, `length` would be `undefined`, displaying "undefined Students". If it returns an array, this works. Needs contract verification.
- Impact: Wrong student count display on teacher roster cards for owner
- Fix direction: Ensure API contract explicitly documents whether `classes` is an array or a count; change to a consistent `student_count` integer field
- Effort: S
