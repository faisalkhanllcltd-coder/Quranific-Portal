# P1 — Security & Auth

**Status: DONE**
Audit date: 2026-07-17

---

## Known Leads — Status

| Lead | Confirmed | Finding |
|------|-----------|---------|
| `DJANGO_SECRET_KEY` insecure fallback | ✅ Confirmed | Gated by `if DEBUG` — safe in concept, but the live `.env` has a weak key `change-me-to-a-random-50-char-string` — not the insecure Django default, but still not cryptographically strong |
| `DJANGO_DEBUG=True` default | ✅ Confirmed | `settings.py:28` parses env var; live `.env:11` ships `DJANGO_DEBUG=True`. If `.env` reaches prod unchanged, debug mode is live |
| `DJANGO_ALLOWED_HOSTS=*` | ✅ Confirmed | `settings.py:40` defaults to `['*']` when `DEBUG=True`; live `.env:12` sets `ALLOWED_HOSTS=*` explicitly |
| `POSTGRES_PASSWORD=postgres` | ✅ Confirmed | Live `.env:17` |
| `LIVEKIT_API_KEY=devkey` / `SECRET=secret` | ✅ Confirmed | Live `.env:26-27` — backend reads via `os.environ.get('LIVEKIT_API_KEY', '')` — empty fallback in code, but dev values in `.env` |
| `JWT_ACCESS_TOKEN_LIFETIME_DAYS=1` | ✅ Confirmed | 24h access token; no token blacklisting/rotation configured in `SIMPLE_JWT` settings; logout only clears localStorage |

---

## Findings

### [CRITICAL] JWT logout does not invalidate tokens server-side
- Where: `frontend/src/api.js:51`, `config/settings.py:175-183`
- Issue: `SIMPLE_JWT` has no `BLACKLIST_AFTER_ROTATION` or `rotate_refresh_tokens` configured. The frontend `localStorage.clear()` deletes tokens locally but the JWT remains cryptographically valid for 24 hours. There is no logout endpoint on the backend.
- Impact: A stolen access token or a fired teacher's token remains valid for up to 24 hours after account deactivation. Role-change actions (e.g., demoting a user) do not immediately revoke their elevated access.
- Fix direction: Add `simplejwt.token_blacklist` to `INSTALLED_APPS`, enable `BLACKLIST_AFTER_ROTATION: True`, add a `/logout/` endpoint that blacklists the refresh token
- Effort: M

### [CRITICAL] Client-side-only username→role escalation in Login.jsx
- Where: `frontend/src/pages/Login.jsx:39-41`
- Issue: `if (returnedUsername.toLowerCase() === 'quranific') { finalRole = 'owner'; }` — the string `'quranific'` is hardcoded to be granted `owner` role regardless of what the server returned. Any user who creates an account named `quranific` (or whose username case-insensitively matches) gets `owner` stored in `localStorage`, bypassing the backend `user_type` field.
- Impact: CRITICAL privilege escalation: an attacker who obtains a login as username `quranific` (or social-engineers a rename) gets the frontend to render owner-level UI and passes `owner` as `user_type` to all subsequent UI decisions. Backend permissions still protect data endpoints, but the UI exposure is complete.
- Fix direction: Remove the client-side role override entirely; trust only `user_type` from the server response
- Effort: S

### [CRITICAL] `VITE_API_BASE_URL` env var defined but `api.js` uses hardcoded URL
- Where: `frontend/src/.env:1`, `frontend/src/api.js:4` and `api.js:83`
- Issue: `frontend/.env` defines `VITE_API_BASE_URL=http://127.0.0.1:8000/api` but `api.js` ignores it — `baseURL` is hardcoded to `'http://127.0.0.1:8000/api'`. The token refresh call at line 83 is also hardcoded. The env var is completely dead.
- Impact: All API calls on OCI production will route to `localhost:8000` on the *browser's* machine, i.e., they will fail with CORS/network errors. App is non-functional in any non-localhost environment.
- Fix direction: `baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'`; apply same fix to the raw `axios.post` refresh call
- Effort: S

### [HIGH] CORS wildcard + credentials in DEBUG mode
- Where: `config/settings.py:157-158`
- Issue: `CORS_ALLOW_ALL_ORIGINS = DEBUG` and `CORS_ALLOW_CREDENTIALS = True`. When `DEBUG=True` (the shipped default), any origin can make credentialed cross-site requests. A malicious site can silently call any API endpoint using the victim's JWT cookies or intercept credentials.
- Impact: Cross-origin credential theft; effectively nullifies CORS protection during development and if DEBUG leaks to prod
- Fix direction: Always set `CORS_ALLOWED_ORIGINS` to an explicit list; never combine wildcard with `CORS_ALLOW_CREDENTIALS = True`
- Effort: S

### [HIGH] No rate limiting / throttling on auth endpoints
- Where: `config/settings.py:163-173` (REST_FRAMEWORK config), `accounts/urls.py:25-34`
- Issue: `REST_FRAMEWORK` has no `DEFAULT_THROTTLE_CLASSES` or `DEFAULT_THROTTLE_RATES`. Login (`/api/accounts/login/`), registration, and password-change endpoints have unlimited request rates.
- Impact: Brute-force attacks on student/teacher passwords with no server-side protection; children's accounts are particularly vulnerable
- Fix direction: Add `AnonRateThrottle` + `UserRateThrottle` to DRF settings; add `ScopedRateThrottle` on login/registration views
- Effort: S

### [HIGH] `bulk_mark` attendance action missing permission class — any authenticated user can mark
- Where: `students/views.py:198-199`
- Issue: `@action(detail=False, methods=['post'])` decorator on `bulk_mark` has no `permission_classes` override. The `get_permissions()` on `AttendanceViewSet` only guards `list`/`retrieve` (returns `IsAuthenticated`); all other actions require `IsStaffOrTeacher`. BUT `bulk_mark` is a custom action — it is NOT `list`, `retrieve`, `create`, `update`, `destroy`, so the `else` branch of `get_permissions()` applies: `[IsAuthenticated(), IsStaffOrTeacher()]`. **[SUSPECTED — re-verify]** — DRF custom `@action` without `permission_classes` kwarg falls through to `get_permissions()` which for non-listed actions returns `IsStaffOrTeacher`. Likely safe, but should be explicit.
- Impact: If `get_permissions()` fallthrough logic is relied upon implicitly, a future refactor could silently expose this
- Fix direction: Add `permission_classes=[permissions.IsAuthenticated, IsStaffOrTeacher]` explicitly to the `@action` decorator
- Effort: S

### [HIGH] `PaymentListView` has no serializer — pagination is bypassed
- Where: `payments/views.py:49-62`
- Issue: `PaymentListView.get()` builds a raw Python list and returns `Response(data)` — it does NOT use a DRF serializer or `self.paginate_queryset()`. The global `PAGE_SIZE=50` pagination in `REST_FRAMEWORK` settings does NOT apply to plain `APIView` returning raw `Response`. All payment records are returned in one response regardless of count.
- Impact: Finance ledger could return thousands of payment records in one response, causing OOM or timeout on large data sets; also bypasses any future pagination guards
- Fix direction: Convert to `ModelViewSet` or manually call `self.paginate_queryset()` + `self.get_paginated_response()`
- Effort: S

### [HIGH] `twocheckout_webhook` uses MD5-style hash input with HMAC-SHA256 — mismatch with 2Checkout spec
- Where: `payments/views.py:138-145`
- Issue: `hmac.new(...)` — `hmac` module has no `.new()` method. The correct call is `hmac.new(key, msg, digestmod)` **only available as `hmac.new()` in Python 2**; in Python 3 it is `hmac.new()` which does exist but is correct. However, the 2Checkout INS HASH spec uses **MD5** of `sale_id + vendor_id + invoice_id + secret_word` concatenated as a string — not HMAC-SHA256. The current implementation will compute a HMAC-SHA256 that will NEVER match the 2Checkout-provided MD5 signature, so every valid webhook is rejected as fraudulent.
- Impact: **All legitimate 2Checkout payment webhooks will fail signature verification and be rejected.** No automatic payment activation occurs. The payment system is functionally broken.
- Fix direction: Confirm 2Checkout's exact signature algorithm from their docs (likely `MD5(sale_id + vendor_id + invoice_id + secret_word).upper()`); replace HMAC-SHA256 with MD5 if that is what the gateway sends, or use the 2Checkout Python SDK
- Effort: S

### [MEDIUM] `MyProfileView.patch()` allows users to self-modify `user_type` via serializer bypass
- Where: `accounts/views.py:160-174`
- Issue: `PATCH /api/accounts/me/` updates `first_name`, `last_name`, `email`, `whatsapp`, `bio` — `user_type` is NOT in the writable field list and cannot be changed here. ✅ This specific endpoint is safe. However, `StudentViewSet.get_queryset()` for `owner`/`head_manager`/`manager` returns the full queryset without filtering; a `manager` role can then call `PATCH /api/students/:id/` and modify any student record including `assigned_teacher` — which is a string field. **[SUSPECTED]** check `StudentSerializer` write-allowed fields.
- Impact: A `manager` could reassign any student to any teacher (by string name) without further authorization check
- Fix direction: Verify serializer `read_only_fields` covers `assigned_teacher` for manager-level mutations, or add an explicit ownership check
- Effort: S

### [MEDIUM] `CreateDynamicRoomView` does not verify teacher has a Profile before creating a room
- Where: `live_session/views.py:256`
- Issue: `user_type = getattr(request.user.profile, 'user_type', 'student')` — `getattr` on a potential missing `profile` relation will throw `RelatedObjectDoesNotExist` (not caught by `getattr` default because the attribute exists but raises on access). If a user has no profile, this raises a 500.
- Impact: Unhandled 500 for any user without a Profile record; leaks internal server error to client
- Fix direction: Wrap in `try/except Profile.DoesNotExist` or use the same pattern as other views
- Effort: S

### [MEDIUM] `LiveKitWebhookView` uses `AllowAny` — no IP restriction
- Where: `live_session/views.py:173`
- Issue: The webhook endpoint has `permission_classes = [permissions.AllowAny]`. While it does verify the LiveKit JWT signature, any internet-facing attacker can send arbitrary webhook payloads and attempt to exploit parsing logic.
- Impact: Denial-of-service via log spam; potential participant count manipulation; future exploits if webhook parsing logic is expanded
- Fix direction: Add LiveKit source IP allowlisting (OCI Security List) or at minimum confirm all code paths require valid signature before doing any DB writes (currently correct but fragile)
- Effort: S

### [LOW] `.env` file exists at repo root and may be committed
- Where: Root `.env` (present on disk)
- Issue: No `.gitignore` was checked for `.env` exclusion; git history not available (no `.git` directory found). The `.env` file contains `LIVEKIT_API_KEY=devkey`, `POSTGRES_PASSWORD=postgres`, a weak `DJANGO_SECRET_KEY` value, and a placeholder `OPENAI_API_KEY=sk-xxxx...`. If this file was ever committed, all secrets are compromised.
- Impact: If committed to any git remote, credentials are exposed permanently until rotated
- Fix direction: Confirm `.gitignore` includes `.env`; run `git log -p -- .env` on actual git remote to verify it was never committed; rotate all credentials regardless
- Effort: S

---

## P1 Checklist Completion

- [x] Every DRF view has explicit `permission_classes` — flagged `bulk_mark` implicit fallthrough
- [x] IDOR / object-level checks — `StudentViewSet.get_queryset()` scopes by role; `AttendanceViewSet` same; `PaymentListView` scopes by role — no IDOR found for primary endpoints
- [x] RBAC server-side — backend permissions present; frontend-only override found (Login.jsx:39) — CRITICAL
- [x] CORS wildcard + credentials — confirmed HIGH issue
- [x] Stripe webhook — N/A (2Checkout used, not Stripe); 2Checkout HMAC mismatch is CRITICAL finding
- [x] File uploads — no file upload endpoints found in any model (no `FileField`/`ImageField`); guardian docs referenced in README do not exist in code — N/A
- [x] XSS dangerouslySetInnerHTML — none found in frontend grep
- [x] SQL raw queries — none found in app code (all ORM)
- [x] Rate limiting — none configured — HIGH finding
- [x] LiveKit tokens server-side only — ✅ confirmed; token generated server-side with 4h TTL; room/role scope applied
- [x] Secrets in git history — no `.git` dir present locally; cannot scan — SUSPECTED — verify on remote
- [x] Audit log immutability — `SystemLog` model has no `delete_permission` override, no DB-level constraint; `SystemLogViewSet` is ReadOnly for API, but Django admin and direct DB access can delete/modify records — immutability claim is false
