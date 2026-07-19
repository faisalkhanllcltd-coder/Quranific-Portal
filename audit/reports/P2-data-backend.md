# P2 — Data & Backend Integrity

**Status: DONE**
Audit date: 2026-07-17

---

## Findings

### [CRITICAL] `StudentSerializer` causes massive N+1 queries on list endpoint
- Where: `students/serializers.py:61-63`, `students/views.py:74`
- Issue: `StudentSerializer` has three nested serializers as default fields: `attendance_history` (`student_daily_attendance` reverse relation), `assignments`, and `study_materials`. The `StudentViewSet.get_queryset()` does **not** call `select_related()` or `prefetch_related()` on these reverse FK relations. For a list of N students, this generates 3×N additional queries (one per nested relation per student). At 100 students = 300 extra queries per page.
- Impact: Catastrophic query storm on `/api/students/` — the most-called endpoint (hit by dashboard, analytics, attendance page, assignment page). Will cause database timeout and OOM on production at moderate scale.
- Fix direction: Add `prefetch_related('student_daily_attendance', 'assignments', 'study_materials')` to `StudentViewSet.get_queryset()`; consider a separate lightweight serializer for list vs. detail
- Effort: S

### [CRITICAL] `TeacherListSerializer.get_classes()` runs an extra query per teacher in list
- Where: `accounts/serializers.py:44-54`
- Issue: `get_classes()` is a `SerializerMethodField` that executes `Student.objects.filter(...)` for each teacher in the queryset. If there are N teachers, this is N additional queries on top of the teacher list query.
- Impact: N+1 query problem on `GET /api/accounts/teachers/` — called by dashboard, analytics, student list, owner dashboard simultaneously on page load.
- Fix direction: Pre-annotate the queryset in `TeacherViewSet` with `Prefetch('student_set', ...)` or use `annotate(class_count=Count(...))` and pass via context; remove the per-object DB call
- Effort: M

### [HIGH] Payroll calculation uses `float()` on `DecimalField` — precision loss
- Where: `accounts/views.py:248-249`
- Issue: `base = float(t_data.base_salary)` and `per_student = float(t_data.salary_per_student)` convert `Decimal` values to IEEE 754 float. This introduces floating-point rounding errors in salary calculations (e.g., `0.1 + 0.2 != 0.3` in float). The payroll result `total_calculated` is a Python float that gets JSON-serialized.
- Impact: Salary figures reported to owner may be incorrect at the cent level; cumulative errors across many teachers over months could result in meaningful financial discrepancy. Legal exposure for incorrect payroll reporting.
- Fix direction: Use `Decimal` arithmetic throughout: `base = t_data.base_salary` (already Decimal), multiply as `Decimal(student_count) * per_student`; serialize as `str` or use `RestFramework.serializers.DecimalField`
- Effort: S

### [HIGH] `Payment` model lacks `unique_together` for `(student, month_paid_for)`
- Where: `payments/models.py:9-16`
- Issue: Only `transaction_id` has `unique=True`. Manual payments posted via the React UI (`POST /api/payments/`) do NOT set a `transaction_id` (it defaults to `blank=True, null=True`). Two identical manual payment entries for the same student and month can be inserted freely — no DB constraint prevents double-billing.
- Impact: Finance team could accidentally log the same month's payment twice, inflating revenue figures and causing accounting errors
- Fix direction: Add `class Meta: unique_together = [('student', 'month_paid_for')]` with a `null` exclusion, or validate in the `post()` view before creating
- Effort: S

### [HIGH] `bulk_mark` attendance wraps entire batch in `@transaction.atomic` but swallows partial failures silently
- Where: `students/views.py:197-227`
- Issue: The `@transaction.atomic` decorator means all-or-nothing. BUT the loop catches `Student.DoesNotExist` exceptions and appends to `errors` without re-raising — so the transaction does NOT roll back on partial failure. The decorator is therefore misleading: on a Student.DoesNotExist, the transaction commits with partial data already written (the successful updates before the error).
- Impact: An attendance bulk-mark with some invalid student IDs will silently commit attendance for valid students and return errors for the rest — inconsistent with the developer's atomicity intention. More seriously, any future exception type not listed will cause a full rollback but the error response to the client says "partial success".
- Fix direction: Remove the `@transaction.atomic` decorator if partial commits are intended, or re-raise errors to trigger full rollback on any failure; document the chosen behavior explicitly
- Effort: S

### [MEDIUM] `StudentViewSet.create()` partially fails without rollback if `Profile` creation fails
- Where: `students/views.py:89-141`
- Issue: The `@transaction.atomic` decorator is present. However, the `serializer.save()` at line 113 runs first (creates the Student row), then `User.objects.create_user()` at line 124 creates the auth user. If `serializer.save()` succeeds but `create_user()` raises (e.g., username taken, which is checked at line 105 but could race), the atomic block should roll back — this is correct. The gap: `parent_id` lookup at lines 116-122 silently fails with `pass` without rolling back. A student can be created with no parent link if the parent lookup fails, which is the **intended behavior** per the comment, but it means the `parent_account_id` field is silently ignored without user notification.
- Impact: Data integrity gap — a frontend sending a valid parent_id that somehow fails a DB lookup silently creates an unlinked student with no error. Parent dashboard will not show this child.
- Fix direction: Return a validation error if `parent_id` is provided but the parent User doesn't exist; remove the silent `pass`
- Effort: S

### [MEDIUM] `SystemLog` has no DB-level immutability protection
- Where: `log/models.py:4-14`
- Issue: `SystemLog` has no `update_fields` restriction, no custom `save()` override preventing updates, no DB trigger or permission. The README claims "Immutable audit log" but Django admin and direct DB access can freely UPDATE or DELETE log records. The API is ReadOnly but the data layer is not.
- Impact: Audit log integrity claim is false; a compromised admin account could silently modify or delete audit records; regulatory/compliance exposure if audit log integrity is relied upon for dispute resolution
- Fix direction: Add a custom `save()` override that raises on update (check `self.pk`); set `default_permissions = ('view',)` in `Meta`; at DB level, grant only INSERT + SELECT to the application DB user on this table
- Effort: M

### [MEDIUM] No migration check confirmed — `parent` role added to `Profile.USER_TYPES` with migration but `live_session` `Room` model may have drift
- Where: `live_session/migrations/0001_initial.py` is the only migration
- Issue: [SUSPECTED] The `Room` and `SessionLog` models were created in a single migration. If any model fields were added after `0001_initial.py` was created (e.g., `SessionLog.notes`), there would be unmigrated changes. Since `makemigrations --check` cannot be run without a live environment, this is a suspected risk.
- Impact: Deployment failure on OCI if `migrate` is run against a schema missing columns added post-initial
- Fix direction: Run `python manage.py makemigrations --check --dry-run` before OCI deployment
- Effort: S

### [LOW] `Attendance` model has `unique_together = ('student', 'date')` but extends `SoftDeleteModel`
- Where: `students/models.py:123-124`
- Issue: Soft-deleted attendance records still count against the `unique_together` constraint. If a student's attendance for a date is soft-deleted (sent to vault), a new record for the same student+date cannot be created until the original is hard-deleted.
- Impact: Edge case: re-marking attendance after a vault operation fails with a DB unique violation; teacher gets a confusing error
- Fix direction: Use a partial unique index (PostgreSQL: `WHERE is_deleted = FALSE`) or use `update_or_create` with soft-delete awareness
- Effort: M

### [DEBT] Payment `GET` response shape differs from DRF standard pagination format
- Where: `payments/views.py:49-62`
- Issue: Returns raw list `data = [...]` directly as `Response(data)` — no pagination envelope (`count`, `next`, `previous`, `results`). Frontend handles this with `Array.isArray(payRes.data) ? payRes.data : (payRes.data.results ?? [])` — if pagination is ever added server-side, the frontend ternary guard catches it. But this is fragile and inconsistent.
- Impact: No immediate breakage but inconsistency across endpoints makes API consumers brittle
- Fix direction: Use a proper serializer + `ModelViewSet` for Payment; apply DRF pagination consistently
- Effort: M
