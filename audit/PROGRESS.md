# Quranific Portal — Audit Progress

**Last Updated:** 2026-07-17 | **Auditor:** Antigravity (Senior Production-Readiness Auditor)

---

| Phase | Status | Crit | High | Med | Low | Notes |
|-------|--------|------|------|-----|-----|-------|
| P0    | ✅ DONE | 0    | 2    | 5   | 3   | Full repo recon, app map, smell greps, model analysis |
| P1    | ✅ DONE | 3    | 4    | 3   | 1   | Security & Auth — JWT blacklist, CORS, rate limiting, 2Checkout HMAC |
| P2    | ✅ DONE | 2    | 3    | 3   | 1   | Data & Backend — N+1 storm, float precision, payment dedup |
| P3    | ✅ DONE | 1    | 4    | 3   | 1   | API Contract — hardcoded URL, broken parent dropdown, password input types |
| P4    | ✅ DONE | 0    | 2    | 3   | 2   | Incomplete & Dead Code — empty ai_bot, broken CI/CD, no file storage |
| P5    | ✅ DONE | 0    | 1    | 4   | 3   | UX & A11y — child PII display, ARIA missing, WhatsApp validation |
| P6    | ✅ DONE | 2    | 2    | 3   | 2   | Performance — 1208 DB queries per page load, no connection pool, no cache |
| P7    | ✅ DONE | 3    | 4    | 3   | 1   | OCI Deploy — no HTTPS, no gunicorn, no Dockerfile, DB port exposed |
| P8    | ✅ DONE | 1    | 4    | 3   | 1   | RBAC Logic — manager overprivileged, teacher PII to students, parent isolation |
| P9    | ⏭ SKIPPED | — | —   | —   | —   | (Phase P9 not defined in original directive) |

---

## TOTALS

| Severity | Count |
|----------|-------|
| CRITICAL | **12** |
| HIGH     | **26** |
| MEDIUM   | **30** |
| LOW      | **15** |
| **Total** | **83** |

---

## Top Critical Findings

| # | Phase | Finding | File / Line |
|---|-------|---------|-------------|
| C1 | P1 | JWT tokens not invalidated on logout — 24h window | `config/settings.py:175` |
| C2 | P1 | Hardcoded username→owner role escalation in Login.jsx | `Login.jsx:39-41` |
| C3 | P1 | `api.js` ignores `VITE_API_BASE_URL` — all prod API calls go to localhost | `api.js:4, 83` |
| C4 | P2 | `StudentSerializer` causes 3N+2 query storm on list endpoint | `serializers.py:61-63` |
| C5 | P2 | Payroll uses `float()` on `Decimal` — financial precision loss | `accounts/views.py:248-249` |
| C6 | P6 | `GET /api/students/` generates 1208+ DB queries on dashboard load | All dashboard pages |
| C7 | P6 | No DB connection pooling — new TCP connection per request | `settings.py:99-108` |
| C8 | P7 | No HTTPS configuration — credentials transmitted in plaintext | Entire project |
| C9 | P7 | DEBUG=True + ALLOWED_HOSTS=* in shipped .env | `.env:11-12` |
| C10 | P7 | No gunicorn — dev server only | `requirements.txt` |
| C11 | P1 | 2Checkout webhook HMAC algorithm mismatches gateway spec — all webhooks rejected | `payments/views.py:138` |
| C12 | P8 | Frontend role derived from client-side localStorage (no server re-validation) | `Login.jsx:39`, `RoleRoute.jsx:22` |

---

## Resume Pointers (for future sessions)

- P1 suspected: Verify `PaymentListView.post()` has `IsOwnerOrManager` permission check
- P3 suspected: Verify `TeacherListSerializer.get_classes()` return type (array vs count integer)
- P8 suspected: Confirm `PaymentListView.post()` permission enforcement
- P9: Not defined in directive — consider a P9 for Children's Data Privacy (COPPA compliance checklist)
