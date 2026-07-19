"""
tests/test_attendance.py — Attendance endpoint tests.

Covers: basic mark-attendance (CRUD), IsStaffOrTeacher permission boundary
(A-P1-07 regression — student and parent cannot mark attendance), data
isolation (teacher sees only their assigned students' records), and the
unique_together constraint (same student + date → 400).
"""
import pytest
from rest_framework.test import APIClient
from django.utils import timezone
from tests.factories import (
    OwnerUserFactory,
    ManagerUserFactory,
    TeacherUserFactory,
    StudentUserFactory,
    ParentUserFactory,
    StudentFactory,
    AttendanceFactory,
)


def _login(username, password="TestPass123!"):
    client = APIClient()
    resp = client.post(
        "/api/accounts/login/",
        {"username": username, "password": password},
        format="json",
    )
    assert resp.status_code == 200
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")
    return client


@pytest.mark.django_db
class TestAttendanceCreate:
    """POST /api/attendance/ — who can mark attendance and who cannot."""

    def _today(self):
        return timezone.localdate().isoformat()

    def test_teacher_can_mark_attendance_present(self):
        """A teacher must be able to POST an attendance record and get 201."""
        teacher_user = TeacherUserFactory()
        student = StudentFactory(assigned_teacher=teacher_user.username)
        client = _login(teacher_user.username)
        response = client.post(
            "/api/attendance/",
            {"student": student.id, "date": self._today(), "status": "Present"},
            format="json",
        )
        assert response.status_code == 201, (
            f"Teacher was denied attendance marking (got {response.status_code}): {response.data}"
        )

    def test_owner_can_mark_attendance(self):
        """Owner must also be able to POST attendance (IsStaffOrTeacher includes owner)."""
        owner_user = OwnerUserFactory()
        student = StudentFactory()
        client = _login(owner_user.username)
        response = client.post(
            "/api/attendance/",
            {"student": student.id, "date": self._today(), "status": "Present"},
            format="json",
        )
        assert response.status_code == 201

    def test_manager_can_mark_attendance(self):
        """Manager is included in IsStaffOrTeacher and must be able to mark attendance."""
        manager_user = ManagerUserFactory()
        student = StudentFactory()
        client = _login(manager_user.username)
        response = client.post(
            "/api/attendance/",
            {"student": student.id, "date": self._today(), "status": "Absent"},
            format="json",
        )
        assert response.status_code == 201

    def test_student_cannot_mark_attendance(self):
        """
        A-P1-07 REGRESSION: a student must receive 403 on POST /api/attendance/.

        Before A-P1-07, the bulk_mark action relied on the else-branch of
        get_permissions() which could be bypassed if the method list changed.
        IsStaffOrTeacher now explicitly blocks student and parent roles.
        """
        student_user = StudentUserFactory()
        target_student = StudentFactory()
        client = _login(student_user.username)
        response = client.post(
            "/api/attendance/",
            {"student": target_student.id, "date": self._today(), "status": "Present"},
            format="json",
        )
        assert response.status_code == 403, (
            f"Student was allowed to mark attendance (got {response.status_code}) "
            "— A-P1-07 regression: IsStaffOrTeacher gate is missing."
        )

    def test_parent_cannot_mark_attendance(self):
        """
        A-P1-07 REGRESSION: a parent must also receive 403 on attendance marking.
        IsStaffOrTeacher explicitly denies the parent role.
        """
        parent_user = ParentUserFactory()
        student = StudentFactory(parent_account=parent_user)
        client = _login(parent_user.username)
        response = client.post(
            "/api/attendance/",
            {"student": student.id, "date": self._today(), "status": "Present"},
            format="json",
        )
        assert response.status_code == 403, (
            f"Parent was allowed to mark their child's attendance (got {response.status_code}) "
            "— A-P1-07 regression."
        )


@pytest.mark.django_db
class TestAttendanceConstraints:
    """Attendance model constraints: unique_together (student, date)."""

    def test_duplicate_attendance_same_student_same_date_rejected(self):
        """
        Marking the same student on the same date twice must fail with a
        non-500 response (400 or 409). The unique_together constraint on
        (student, date) should be surfaced cleanly.
        """
        teacher_user = TeacherUserFactory()
        student = StudentFactory(assigned_teacher=teacher_user.username)
        today = timezone.localdate().isoformat()
        client = _login(teacher_user.username)

        first = client.post(
            "/api/attendance/",
            {"student": student.id, "date": today, "status": "Present"},
            format="json",
        )
        assert first.status_code == 201

        second = client.post(
            "/api/attendance/",
            {"student": student.id, "date": today, "status": "Absent"},
            format="json",
        )
        # Expect a client-error response (400 or 409), not a 500 crash
        assert second.status_code in (400, 409), (
            f"Duplicate attendance was accepted or crashed (got {second.status_code}) "
            "— unique_together constraint is not surfaced as a client error."
        )


@pytest.mark.django_db
class TestAttendanceDataIsolation:
    """GET /api/attendance/ — teachers see only their assigned students."""

    def test_teacher_sees_only_assigned_students_attendance(self):
        """
        A teacher's attendance list must contain only records for students
        whose assigned_teacher matches their username (case-insensitive).

        Data isolation: StudentViewSet.get_queryset() filters on
        assigned_teacher__iexact=user.username for teacher role.
        AttendanceViewSet inherits the same scoping.
        """
        teacher_user = TeacherUserFactory()
        other_teacher_user = TeacherUserFactory()

        # Student assigned to our teacher
        my_student = StudentFactory(assigned_teacher=teacher_user.username)
        # Student assigned to a different teacher
        other_student = StudentFactory(assigned_teacher=other_teacher_user.username)

        # Create attendance records for both
        AttendanceFactory(student=my_student)
        AttendanceFactory(student=other_student)

        client = _login(teacher_user.username)
        response = client.get("/api/attendance/")

        assert response.status_code == 200
        student_ids_in_response = {
            record["student"]
            for record in response.data.get("results", response.data)
        }
        assert my_student.id in student_ids_in_response, (
            "Teacher cannot see their own student's attendance."
        )
        assert other_student.id not in student_ids_in_response, (
            "Teacher can see another teacher's student's attendance — data isolation breach."
        )
