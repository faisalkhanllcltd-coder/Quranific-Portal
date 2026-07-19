# P8 — RBAC Logic & Data Isolation

**Status: DONE**
Audit date: 2026-07-17

---

## Findings

### [CRITICAL] Frontend role derived from client-side hardcoded username override
- Where: `frontend/src/pages/Login.jsx:39-41`
- Issue: Already documented in P1. Re-listed here as it is the primary RBAC finding.
- All frontend permission decisions (`isOwnerOrManager`, RoleRoute) read from `localStorage.user_type` which is set by the client — and overridable to `owner` for any user named `quranific`.
- Fix direction: See P1. Remove client-side role override.
- Effort: S

### [CRITICAL] `StudentViewSet` owners/managers see ALL students with NO isolation
- Where: `students/views.py:71-87`
- Issue: For roles `owner`, `head_manager`, `manager` — the `get_queryset()` falls through the `if/elif` chain and returns `queryset` (all students, all families). This is intentional per RBAC design, but the `StudentSerializer` returns the full student PII object including `guardian_whatsapp`, `guardian_email`, `guardian_name`, `email`, `whatsapp` for every student.
- Impact: A `manager` role can extract all student PIIs in one request. If a manager account is compromised, all student and family contact details are exposed.
- Fix direction: Acceptable by design but document explicitly; consider role-gated serializer fields (managers see less PII than owners); add rate limiting to mitigate bulk extraction
- Effort: M (documentation + field scoping)

### [HIGH] `manager` role has same data access as `owner` with no capability split
- Where: `accounts/views.py:16-30` (IsOwner, IsOwnerOrManager custom permissions)
- Issue: `IsOwnerOrManager` grants access to `StudentViewSet` write operations (create, update, delete) for `manager` role exactly the same as `owner`. There is no `manager`-specific scope — a manager can delete any student, modify any assignment, and access all payment records, the same as the owner.
- Impact: Insufficient privilege separation — the `manager` role cannot be safely delegated to external parties without full data and destructive operation access
- Fix direction: Define explicit capability differences for `manager` vs `owner` (e.g., managers cannot delete students, cannot access payroll, cannot modify system-level settings)
- Effort: M

### [HIGH] Teacher's own profile is accessible via `GET /api/accounts/teachers/:id/` by any authenticated user
- Where: `accounts/views.py:283-286`
- Issue: `TeacherViewSet.get_permissions()` returns `[IsAuthenticated()]` for `list` and `retrieve` actions. A student can therefore call `GET /api/accounts/teachers/5/` and receive the full `TeacherListSerializer` response including `bank_details`, `base_salary`, `salary_per_student`, and `teacher_data`.
- Impact: Children can see teacher salary and bank details. Financial data of staff is exposed to lowest-privilege role.
- Fix direction: Move financial fields to a separate admin-only serializer; return a public-facing `TeacherPublicSerializer` (name only) to students; restrict `TeacherListSerializer` (with financial data) to `IsOwnerOrManager`
- Effort: S

### [HIGH] `AttendanceViewSet` owner/manager can see attendance for ALL students — no scope enforcement for manager
- Where: `students/views.py:181-195`
- Issue: For `owner`, `head_manager`, and `manager` roles, `get_queryset()` returns `queryset` (all attendance records). A `manager` can therefore read attendance for every student regardless of which teacher they are assigned to.
- Impact: Managers can reconstruct every student's full attendance history; used with PaymentListView, they can profile family payment + attendance patterns
- Fix direction: Acceptable by design for owner; consider adding a manager scope filter; document explicitly
- Effort: M

### [HIGH] `PaymentListView` returns all payments to any authenticated user without role check
- Where: `payments/views.py:49-62`
- Issue: `get_permissions` likely defaults to DRF `DEFAULT_PERMISSION_CLASSES` which is `[IsAuthenticated]`. The `get()` method filters by `request.user`'s role (`owner/manager` → all, `parent` → own students). But the `post()` method — which creates a payment — needs verification.
- Impact: [SUSPECTED — post() not fully read] If `post()` has no `IsOwnerOrManager` check, any authenticated user (student, teacher, parent) could create a payment record.
- Fix direction: Read and verify `PaymentListView.post()` permissions; ensure write operations require `IsOwnerOrManager`
- Effort: S

### [MEDIUM] `SystemAccessViewSet.partial_update()` allows owner to change any user's role including other owners
- Where: `accounts/views.py:314-335`
- Issue: There is no guard preventing an owner from changing another owner's `is_active` to `False` or role to `student`. In a multi-owner scenario (or if the owner account is compromised), one privileged account can lock out another.
- Impact: No self-protection mechanism for the primary owner account; in a social engineering attack where an adversary gains owner access, they can immediately lock out the real owner
- Fix direction: Add a check: if `pk == request.user.id` or if target user is an owner, require a second-factor confirmation; at minimum, prevent deactivating your own account
- Effort: S

### [MEDIUM] Parent role sees other parents' students if `parent_account` FK is misassigned
- Where: `students/views.py:79-81`
- Issue: `queryset.filter(parent_account=user)` — a student can only be linked to one parent account (`ForeignKey`). If during enrollment the `parent_account_id` is set to the wrong parent (accidental data entry), that parent sees another family's child.
- Impact: GDPR/COPPA violation — parent A sees parent B's child's attendance, assignments, and profile
- Fix direction: This is a data quality issue rather than a code bug; add confirmation step during enrollment showing parent details before saving; add audit log entry for every `parent_account` change
- Effort: S

### [LOW] No `is_active=False` enforcement in authentication flow
- Where: `config/settings.py:175-183` (SIMPLE_JWT config)
- Issue: `SimpleJWT` does not check `User.is_active` by default during token refresh. If a user is deactivated via `SystemAccessViewSet.partial_update()` (setting `is_active=False`), their existing access token remains valid until expiry (24h), and the refresh token can be used to obtain new access tokens.
- Impact: Deactivated accounts remain functionally active for up to 24h + refresh token lifetime
- Fix direction: Implement token blacklisting (see P1 finding); JWT blacklist ensures deactivated users cannot refresh; also set `AUTH_TOKEN_CLASSES` to a custom class that checks `is_active` on every request
- Effort: M
