"""
tests/test_rbac.py — Role-boundary regression tests.

One test per fixed role boundary from the A-P8 and A-P3 series.
Every test is a regression: if the permission class is ever loosened
incorrectly, the test will catch it immediately.

Permission class hierarchy (most → least privileged):
  IsOwner              → owner only
  IsOwnerOrHeadManager → owner, head_manager           (A-P8-02)
  IsOwnerOrManager     → owner, head_manager, manager
  IsStaffOrTeacher     → all of the above + teacher
  IsAuthenticated      → all logged-in users
"""
import pytest
from rest_framework.test import APIClient
from tests.factories import (
    OwnerUserFactory, HeadManagerUserFactory, ManagerUserFactory,
    TeacherUserFactory, StudentUserFactory, ParentUserFactory,
    StudentFactory,
)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _login(username, password="TestPass123!"):
    """Returns an authenticated APIClient for the given credentials."""
    client = APIClient()
    resp = client.post(
        "/api/accounts/login/",
        {"username": username, "password": password},
        format="json",
    )
    assert resp.status_code == 200, f"Login failed for {username}: {resp.data}"
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")
    return client


# ─────────────────────────────────────────────────────────────────────────────
# A-P8-02 — StudentViewSet.destroy() / update_credentials()
# IsOwnerOrHeadManager gate: manager is BLOCKED, head_manager is ALLOWED
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestStudentDestroyPermissions:
    """
    DELETE /api/students/<id>/ must be gated by IsOwnerOrHeadManager.
    A plain manager must receive 403; head_manager and owner must receive 204.
    """

    def test_manager_cannot_delete_student(self):
        """
        A-P8-02 REGRESSION: manager → DELETE /api/students/<id>/ must be 403.

        Before A-P8-02, get_permissions() returned IsOwnerOrManager for all
        write operations, including destroy — giving managers delete access.
        """
        student = StudentFactory()
        manager_user = ManagerUserFactory()
        client = _login(manager_user.username)
        response = client.delete(f"/api/students/{student.id}/")
        assert response.status_code == 403, (
            f"Manager was allowed to delete a student (got {response.status_code}) "
            "— A-P8-02 regression: IsOwnerOrHeadManager gate is missing."
        )

    def test_head_manager_can_delete_student(self):
        """head_manager must be able to delete students (allowed by IsOwnerOrHeadManager)."""
        student = StudentFactory()
        hm_user = HeadManagerUserFactory()
        client = _login(hm_user.username)
        response = client.delete(f"/api/students/{student.id}/")
        assert response.status_code in (200, 204), (
            f"head_manager was denied student deletion (got {response.status_code})."
        )

    def test_owner_can_delete_student(self):
        """owner must be able to delete students."""
        student = StudentFactory()
        owner_user = OwnerUserFactory()
        client = _login(owner_user.username)
        response = client.delete(f"/api/students/{student.id}/")
        assert response.status_code in (200, 204)

    def test_teacher_cannot_delete_student(self):
        """Teachers are not in IsOwnerOrHeadManager and must receive 403."""
        student = StudentFactory()
        teacher_user = TeacherUserFactory()
        client = _login(teacher_user.username)
        response = client.delete(f"/api/students/{student.id}/")
        assert response.status_code == 403

    def test_student_cannot_delete_student(self):
        """Students must receive 403 on any delete."""
        target = StudentFactory()
        student_user = StudentUserFactory()
        client = _login(student_user.username)
        response = client.delete(f"/api/students/{target.id}/")
        assert response.status_code == 403


@pytest.mark.django_db
class TestUpdateCredentialsPermissions:
    """
    POST /api/students/<id>/update_credentials/ gated by IsOwnerOrHeadManager.
    A plain manager must receive 403.
    """

    def test_manager_cannot_reset_student_credentials(self):
        """
        A-P8-02 REGRESSION: manager → POST update_credentials must be 403.

        Resetting another user's login is a high-privilege destructive action.
        Before A-P8-02 it was guarded only by IsOwnerOrManager, letting plain
        managers reset credentials of any student.
        """
        from django.contrib.auth.models import User as DjangoUser
        # Create a student with an actual User account for the endpoint to target
        student_login_user = DjangoUser.objects.create_user(
            username="student_login_target", password="OldPass123!"
        )
        student = StudentFactory(user=student_login_user)
        manager_user = ManagerUserFactory()
        client = _login(manager_user.username)
        response = client.post(
            f"/api/students/{student.id}/update_credentials/",
            {"username": "student_login_target", "password": "NewPass123!"},
            format="json",
        )
        assert response.status_code == 403, (
            f"Manager was allowed to reset student credentials (got {response.status_code}) "
            "— A-P8-02 regression."
        )

    def test_owner_can_reset_student_credentials(self):
        """owner must be able to reset student credentials (200 OK)."""
        from django.contrib.auth.models import User as DjangoUser
        student_login_user = DjangoUser.objects.create_user(
            username="student_for_owner_reset", password="OldPass123!"
        )
        student = StudentFactory(user=student_login_user)
        owner_user = OwnerUserFactory()
        client = _login(owner_user.username)
        response = client.post(
            f"/api/students/{student.id}/update_credentials/",
            {"username": "student_for_owner_reset", "password": "NewPass999!"},
            format="json",
        )
        assert response.status_code == 200, (
            f"Owner was denied credential reset (got {response.status_code})."
        )


# ─────────────────────────────────────────────────────────────────────────────
# A-P8-03 — TeacherViewSet serializer scoping
# Students must NOT see teacher financial data; admins must see it.
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestTeacherSerializerScoping:
    """
    GET /api/accounts/teachers/<id>/ must return different field sets
    depending on the caller's role.

    A-P8-03 REGRESSION guard: if TeacherPublicSerializer is accidentally
    removed or bypassed, financial fields would leak to low-privilege users.
    """

    FINANCIAL_FIELDS = {"base_salary", "salary_per_student", "teacher_data",
                        "email", "is_active", "whatsapp"}

    def _create_teacher_and_get_id(self):
        """Create a teacher user and return their teacher list entry id."""
        teacher_user = TeacherUserFactory()
        return teacher_user

    def test_student_cannot_see_teacher_financial_fields(self):
        """
        A student calling GET /api/accounts/teachers/<id>/ must receive
        a response that contains NO financial fields (base_salary, teacher_data,
        email, whatsapp, is_active).

        A-P8-03 REGRESSION: before this fix, TeacherListSerializer (with all
        financial data) was returned to every authenticated user.
        """
        teacher_user = TeacherUserFactory()
        student_user = StudentUserFactory()
        client = _login(student_user.username)

        response = client.get(f"/api/accounts/teachers/{teacher_user.id}/")
        assert response.status_code == 200

        response_keys = set(response.data.keys())
        leaked_fields = self.FINANCIAL_FIELDS & response_keys
        assert not leaked_fields, (
            f"Student received financial fields for a teacher: {leaked_fields} "
            "— A-P8-03 regression: TeacherPublicSerializer gate is missing."
        )

    def test_admin_can_see_teacher_financial_fields(self):
        """An owner calling the same endpoint must receive the full serializer.

        base_salary is nested under teacher_data in the admin serializer:
            response.data["teacher_data"]["base_salary"]
        The presence of the teacher_data key itself (with financial sub-fields)
        is sufficient to confirm the full serializer is being returned.
        """
        teacher_user = TeacherUserFactory()
        owner_user = OwnerUserFactory()
        client = _login(owner_user.username)

        response = client.get(f"/api/accounts/teachers/{teacher_user.id}/")
        assert response.status_code == 200
        # Admin response must contain the teacher_data block (financial sub-object)
        assert "teacher_data" in response.data, (
            "Owner did not receive teacher_data in TeacherListSerializer — "
            "the serializer gate may be inverted."
        )
        teacher_data = response.data["teacher_data"]
        assert "base_salary" in teacher_data, (
            f"teacher_data exists but has no base_salary key: {teacher_data}"
        )


# ─────────────────────────────────────────────────────────────────────────────
# A-P8-04 — PaymentListView POST permission gate
# Students and teachers must be blocked; manager must be allowed.
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestPaymentPostPermissions:
    """
    POST /api/payments/ must be gated by IsOwnerOrManager.
    Students, teachers, and parents must receive 403.

    A-P8-04 REGRESSION guard: before the fix, DEFAULT_PERMISSION_CLASSES
    (IsAuthenticated only) applied to POST — any logged-in user could
    create a payment record.
    """

    def _payment_payload(self):
        student = StudentFactory()
        return {
            "student": student.id,
            "amount": "75.00",
            "month_paid_for": "2026-08",
            "method": "Manual",
        }

    def test_student_cannot_post_payment(self):
        """A-P8-04 REGRESSION: student → POST /api/payments/ must be 403."""
        student_user = StudentUserFactory()
        client = _login(student_user.username)
        response = client.post("/api/payments/", self._payment_payload(), format="json")
        assert response.status_code == 403, (
            f"Student was allowed to create a payment (got {response.status_code}) "
            "— A-P8-04 regression."
        )

    def test_teacher_cannot_post_payment(self):
        """A-P8-04 REGRESSION: teacher → POST /api/payments/ must be 403."""
        teacher_user = TeacherUserFactory()
        client = _login(teacher_user.username)
        response = client.post("/api/payments/", self._payment_payload(), format="json")
        assert response.status_code == 403

    def test_parent_cannot_post_payment(self):
        """parent role must also be blocked from payment creation."""
        parent_user = ParentUserFactory()
        client = _login(parent_user.username)
        response = client.post("/api/payments/", self._payment_payload(), format="json")
        assert response.status_code == 403

    def test_manager_can_post_payment(self):
        """Positive case: manager must be able to create a manual payment (201)."""
        manager_user = ManagerUserFactory()
        client = _login(manager_user.username)
        response = client.post("/api/payments/", self._payment_payload(), format="json")
        assert response.status_code == 201, (
            f"Manager was denied payment creation (got {response.status_code}) — "
            f"response: {response.data}"
        )

    def test_owner_can_post_payment(self):
        """Positive case: owner must be able to create a manual payment."""
        owner_user = OwnerUserFactory()
        client = _login(owner_user.username)
        response = client.post("/api/payments/", self._payment_payload(), format="json")
        assert response.status_code == 201


# ─────────────────────────────────────────────────────────────────────────────
# A-P4-01 / IsOwner — SystemAccessViewSet gate
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestSystemAccessPermissions:
    """
    GET /api/accounts/system-access/ must be gated by IsOwner.
    manager, head_manager, teacher, student must all receive 403.
    """

    def test_manager_cannot_list_system_access(self):
        """manager must receive 403 on the system-access endpoint."""
        manager_user = ManagerUserFactory()
        client = _login(manager_user.username)
        response = client.get("/api/accounts/system-access/")
        assert response.status_code == 403

    def test_head_manager_cannot_list_system_access(self):
        """head_manager must also receive 403 (IsOwner only, not IsOwnerOrHeadManager)."""
        hm_user = HeadManagerUserFactory()
        client = _login(hm_user.username)
        response = client.get("/api/accounts/system-access/")
        assert response.status_code == 403

    def test_owner_can_list_system_access(self):
        """owner must receive 200 with a paginated response."""
        owner_user = OwnerUserFactory()
        client = _login(owner_user.username)
        response = client.get("/api/accounts/system-access/")
        assert response.status_code == 200
        # Pagination envelope added in A-P4-01
        assert "results" in response.data, (
            "System access response is not paginated — A-P4-01 regression."
        )


# ─────────────────────────────────────────────────────────────────────────────
# General Hardening — MyProfileView PATCH validation
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestMyProfileViewPermissions:
    """
    PATCH /api/accounts/me/ must only accept an explicit allowlist of fields.
    """

    def test_manager_cannot_patch_invalid_profile_fields(self):
        """
        GENERAL HARDENING: PATCH /api/accounts/me/ with
        'assigned_teacher' or other invalid fields must be rejected with 400.
        """
        manager_user = ManagerUserFactory()
        student = StudentFactory(assigned_teacher="old_teacher")
        
        client = _login(manager_user.username)
        response = client.patch(
            "/api/accounts/me/",
            {"first_name": "NewName", "assigned_teacher": manager_user.username},
            format="json",
        )
        assert response.status_code == 400, (
            f"Manager was allowed to patch profile with invalid fields (got {response.status_code})."
        )
        
        # Confirm student was not modified
        student.refresh_from_db()
        assert student.assigned_teacher == "old_teacher", (
            "Student was reassigned despite 400 response."
        )
        
        # Confirm manager's profile was not updated either (entire request rejected)
        manager_user.refresh_from_db()
        assert manager_user.first_name != "NewName", (
            "Manager profile updated partially despite 400 response."
        )


# ─────────────────────────────────────────────────────────────────────────────
# A-P1-09 — StudentViewSet Manager Write Restrictions
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestStudentManagerWriteRestrictions:
    """
    A-P1-09: Managers can edit student contact/bio fields, but cannot 
    reassign teachers, change status, or alter class timings.
    """

    def test_manager_cannot_reassign_student_teacher(self):
        manager_user = ManagerUserFactory()
        student = StudentFactory(assigned_teacher="old_teacher")
        
        client = _login(manager_user.username)
        response = client.patch(
            f"/api/students/{student.id}/",
            {"assigned_teacher": "new_teacher", "full_name": "Updated Name"},
            format="json",
        )
        assert response.status_code == 400
        
        student.refresh_from_db()
        assert student.assigned_teacher == "old_teacher", "A-P1-09 regression: Manager reassigned student."
        assert student.full_name != "Updated Name", "Update should have been completely blocked by 400."

    def test_head_manager_can_reassign_student_teacher(self):
        hm_user = HeadManagerUserFactory()
        student = StudentFactory(assigned_teacher="old_teacher")
        
        client = _login(hm_user.username)
        response = client.patch(
            f"/api/students/{student.id}/",
            {"assigned_teacher": "new_teacher"},
            format="json",
        )
        assert response.status_code == 200
        
        student.refresh_from_db()
        assert student.assigned_teacher == "new_teacher"

    def test_owner_can_reassign_student_teacher(self):
        owner_user = OwnerUserFactory()
        student = StudentFactory(assigned_teacher="old_teacher")
        
        client = _login(owner_user.username)
        response = client.patch(
            f"/api/students/{student.id}/",
            {"assigned_teacher": "new_teacher"},
            format="json",
        )
        assert response.status_code == 200
        
        student.refresh_from_db()
        assert student.assigned_teacher == "new_teacher"

    def test_teacher_cannot_patch_student(self):
        teacher_user = TeacherUserFactory()
        student = StudentFactory(assigned_teacher=teacher_user.username)
        
        client = _login(teacher_user.username)
        response = client.patch(
            f"/api/students/{student.id}/",
            {"assigned_teacher": "new_teacher"},
            format="json",
        )
        assert response.status_code == 403, "Teacher should get 403 when trying to patch a student."

    def test_student_cannot_patch_student(self):
        student_user = StudentUserFactory()
        student = StudentFactory(user=student_user)
        
        client = _login(student_user.username)
        response = client.patch(
            f"/api/students/{student.id}/",
            {"full_name": "New Name"},
            format="json",
        )
        assert response.status_code == 403, "Student should get 403 when trying to patch their own record."

@pytest.mark.django_db
class TestLiveSessionPermissions:
    def test_create_room_without_profile_returns_403(self):
        from django.contrib.auth.models import User
        # Create a user and manually delete the auto-created profile to test the edge case
        user = User.objects.create_user(username="noprofile", password="Password123")
        user.profile.delete()
        
        client = APIClient()
        response = client.post('/api/accounts/login/', {
            'username': 'noprofile',
            'password': 'Password123'
        }, format='json')
        client.credentials(HTTP_AUTHORIZATION='Bearer ' + response.data['access'])
        
        res = client.post("/api/live/create-room/", {"room_name": "test"}, format="json")
        assert res.status_code == 403
        assert "User profile missing." in res.data.get("error", "")
