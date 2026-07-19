"""
tests/test_payments.py — Payment endpoint tests.

Covers: permission gates (who can GET/POST), the A-P2-04 duplicate constraint
(same student + month → 409), pagination envelope (A-P1-08), and parent
data-isolation (parent sees only their own student's payments).

Note on R-R3-03 (payment idempotency key): when idempotency key support ships,
extend test_duplicate_payment_rejected with an idempotency-key header assertion
— no restructuring of this file needed.
"""
import pytest
from rest_framework.test import APIClient
from tests.factories import (
    OwnerUserFactory,
    ManagerUserFactory,
    TeacherUserFactory,
    StudentUserFactory,
    ParentUserFactory,
    StudentFactory,
    PaymentFactory,
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
class TestPaymentCreate:
    """POST /api/payments/ — happy path, duplicate rejection, and idempotency.

    A-P2-04 REGRESSION: duplicate student+month → 409 (no idempotency key)
    R-R3-03 REGRESSION: same Idempotency-Key header → 200 replay, no new row
    """

    def test_owner_can_create_valid_payment(self):
        """Owner can POST a payment and receive a 201 with the created record."""
        student = StudentFactory()
        owner_user = OwnerUserFactory()
        client = _login(owner_user.username)
        response = client.post(
            "/api/payments/",
            {
                "student": student.id,
                "amount": "60.00",
                "month_paid_for": "2026-08",
                "method": "Manual",
            },
            format="json",
        )
        assert response.status_code == 201
        assert response.data["student"] == student.id
        assert response.data["amount"] == "60.00"
        assert response.data["month_paid_for"] == "2026-08"

    def test_duplicate_payment_same_student_same_month_returns_409(self):
        """
        A-P2-04 REGRESSION: posting the same student + month_paid_for twice
        (WITHOUT an idempotency key) must return 409 Conflict, not 500 or silent dup.

        Before A-P2-04, concurrent duplicate requests could create two payment
        rows. Now the code-level check + DB constraint both reject it.
        """
        student = StudentFactory()
        owner_user = OwnerUserFactory()
        client = _login(owner_user.username)

        payload = {
            "student": student.id,
            "amount": "75.00",
            "month_paid_for": "2026-09",
            "method": "Manual",
        }
        first = client.post("/api/payments/", payload, format="json")
        assert first.status_code == 201, f"First payment failed: {first.data}"

        second = client.post("/api/payments/", payload, format="json")
        assert second.status_code == 409, (
            f"Duplicate payment was accepted (got {second.status_code}) — "
            "A-P2-04 regression: UniqueConstraint or code-level check is missing."
        )

    def test_idempotency_key_replay_returns_original_payment_no_new_row(self):
        """
        R-R3-03 REGRESSION: submitting the same Idempotency-Key header twice
        must return 200 (not 201) with the *same* payment record ID, and
        exactly one row must exist in the DB — no duplicate created.

        Protocol:
          First POST (Idempotency-Key: <uuid>) → 201 Created
          Second POST (same key, same or different body) → 200 OK, replayed=True
          DB row count for that student → 1

        The replayed=True field in the response lets the client distinguish a
        replay from a fresh create without inspecting status codes alone.
        """
        import uuid
        student = StudentFactory()
        owner_user = OwnerUserFactory()
        client = _login(owner_user.username)

        idem_key = str(uuid.uuid4())
        payload = {
            "student": student.id,
            "amount": "80.00",
            "month_paid_for": "2026-12",
            "method": "Manual",
        }

        # First call — must create the payment
        first = client.post(
            "/api/payments/",
            payload,
            format="json",
            HTTP_IDEMPOTENCY_KEY=idem_key,
        )
        assert first.status_code == 201, f"First payment failed: {first.data}"
        first_id = first.data["id"]
        assert first.data.get("idempotency_key") == idem_key

        # Second call — same key → must replay, not create
        second = client.post(
            "/api/payments/",
            payload,
            format="json",
            HTTP_IDEMPOTENCY_KEY=idem_key,
        )
        assert second.status_code == 200, (
            f"Replay should return 200, got {second.status_code}: {second.data}\n"
            "R-R3-03 regression: idempotency key lookup is not working."
        )
        assert second.data["id"] == first_id, (
            f"Replay returned a different payment ID ({second.data['id']} vs {first_id}) "
            "— a new row was created instead of returning the original."
        )
        assert second.data.get("replayed") is True, (
            "Replay response must include replayed=True to distinguish from a fresh 201."
        )

        # DB check: exactly one payment row for this student
        from payments.models import Payment as PaymentModel
        count = PaymentModel.objects.filter(student=student).count()
        assert count == 1, (
            f"Expected 1 payment row, found {count} — idempotency failed, "
            "a duplicate was created despite the same Idempotency-Key."
        )

    def test_idempotency_key_absent_creates_normally(self):
        """
        Without an Idempotency-Key header the endpoint behaves exactly as
        before R-R3-03 — returns 201 and no replayed field.
        """
        student = StudentFactory()
        owner_user = OwnerUserFactory()
        client = _login(owner_user.username)
        response = client.post(
            "/api/payments/",
            {"student": student.id, "amount": "50.00",
             "month_paid_for": "2027-01", "method": "Manual"},
            format="json",
        )
        assert response.status_code == 201
        assert response.data.get("replayed") is None, (
            "No Idempotency-Key sent — replayed field must not appear in the response."
        )

    def test_payment_for_different_months_both_succeed(self):
        """
        The unique constraint is (student, month_paid_for) — two payments for
        the same student in different months must both be accepted.
        """
        student = StudentFactory()
        owner_user = OwnerUserFactory()
        client = _login(owner_user.username)

        r1 = client.post(
            "/api/payments/",
            {"student": student.id, "amount": "60.00", "month_paid_for": "2026-10", "method": "Manual"},
            format="json",
        )
        r2 = client.post(
            "/api/payments/",
            {"student": student.id, "amount": "60.00", "month_paid_for": "2026-11", "method": "Manual"},
            format="json",
        )
        assert r1.status_code == 201
        assert r2.status_code == 201

    def test_idempotency_key_race_condition_handled_gracefully(self):
        """
        R-R3-03 RACE GUARD: two concurrent requests with the same Idempotency-Key
        can both pass the pre-check before either commits. The losing INSERT then
        hits the unique constraint on idempotency_key, raising IntegrityError.

        Without the race guard, this returns 500.
        With the guard, it returns 200 + the winner's payment data + replayed=True.

        Test setup:
          - Pre-create a payment in DB with idem_key="abc" (simulates the winning
            concurrent request having already committed).
          - Patch Payment.objects.filter so the pre-check call returns an empty
            queryset (simulates the race window: the losing request's pre-check
            ran before the winner committed, so it saw nothing).
          - POST with idem_key="abc" + a DIFFERENT month than the pre-existing
            record (avoids the student+month 409 short-circuit, which would fire
            before the create is even attempted).
          - The view tries to INSERT → IntegrityError on idempotency_key → the
            except handler finds the winner and returns 200 + replayed=True.
        """
        import uuid
        from decimal import Decimal
        from unittest.mock import patch
        from payments.models import Payment as PaymentModel

        student = StudentFactory()
        owner_user = OwnerUserFactory()
        client = _login(owner_user.username)
        idem_key = str(uuid.uuid4())

        # Create the "winner" payment directly — bypasses the view entirely.
        winner = PaymentModel.objects.create(
            student=student,
            amount=Decimal("90.00"),
            month_paid_for="2028-01",   # winner's month
            method="Manual",
            status="Paid",
            idempotency_key=idem_key,
        )

        # Capture the real base queryset BEFORE patching to avoid recursion.
        # base_qs.filter() calls the QuerySet's filter, not the Manager's,
        # so the patch does not intercept those calls.
        base_qs = PaymentModel.objects.all()
        call_n = [0]

        def patched_filter(*args, **kwargs):
            call_n[0] += 1
            if call_n[0] == 1 and "idempotency_key" in kwargs:
                # First call: view's pre-check → simulate race window (return empty)
                return base_qs.none()
            # All subsequent calls (student+month duplicate check, except handler
            # lookup) → real filter behaviour via the base queryset.
            return base_qs.filter(*args, **kwargs)

        with patch.object(PaymentModel.objects, "filter", side_effect=patched_filter):
            response = client.post(
                "/api/payments/",
                {
                    "student": student.id,
                    "amount": "90.00",
                    "month_paid_for": "2028-02",   # DIFFERENT month → no 409 short-circuit
                    "method": "Manual",
                },
                format="json",
                HTTP_IDEMPOTENCY_KEY=idem_key,
            )

        assert response.status_code == 200, (
            f"Expected 200 (race guard replay), got {response.status_code}: {response.data}\n"
            "R-R3-03 race guard missing: concurrent Idempotency-Key conflict returns 500."
        )
        assert response.data["id"] == winner.id, (
            f"Race guard returned wrong payment ID ({response.data['id']} vs {winner.id})."
        )
        assert response.data.get("replayed") is True, (
            "Race guard response must include replayed=True."
        )
        # Confirm only the pre-existing row exists — nothing new was created
        total_rows = PaymentModel.objects.filter(student=student).count()
        assert total_rows == 1, (
            f"Expected 1 payment row after race recovery, found {total_rows}."
        )


@pytest.mark.django_db
class TestPaymentList:
    """GET /api/payments/ — data access and pagination."""

    def test_owner_sees_all_payments_in_paginated_response(self):
        """
        Owner GET must return a paginated envelope with count/next/previous/results.

        A-P1-08 REGRESSION: before the fix, PaymentListView.get() returned a
        flat array. Any code expecting the pagination envelope would silently
        break on non-paginated responses.
        """
        # Create two payments for different students
        PaymentFactory(month_paid_for="2026-05")
        PaymentFactory(month_paid_for="2026-06")

        owner_user = OwnerUserFactory()
        client = _login(owner_user.username)
        response = client.get("/api/payments/")

        assert response.status_code == 200
        assert "results" in response.data, (
            "Payments response is not paginated — A-P1-08 regression."
        )
        assert "count" in response.data
        assert isinstance(response.data["results"], list)
        assert response.data["count"] >= 2

    def test_parent_sees_only_own_students_payments(self):
        """
        A parent must see payment records for their linked students only —
        not payments for students belonging to other parents.

        Data isolation: parent_account FK on Student must gate the queryset.
        """
        from django.contrib.auth.models import User as DjangoUser

        # Parent A with their student and a payment
        parent_a_user = ParentUserFactory()
        student_a = StudentFactory(parent_account=parent_a_user)
        PaymentFactory(student=student_a, month_paid_for="2026-05")

        # An unrelated student's payment (different parent)
        other_parent_user = ParentUserFactory()
        student_b = StudentFactory(parent_account=other_parent_user)
        PaymentFactory(student=student_b, month_paid_for="2026-05")

        client = _login(parent_a_user.username)
        response = client.get("/api/payments/")

        assert response.status_code == 200
        student_ids_in_response = {p["student"] for p in response.data["results"]}
        assert student_a.id in student_ids_in_response, (
            "Parent A cannot see their own student's payment."
        )
        assert student_b.id not in student_ids_in_response, (
            "Parent A can see another parent's student's payment — data isolation breach."
        )

    def test_teacher_cannot_access_payment_list(self):
        """Teachers must receive 403 on GET /api/payments/."""
        teacher_user = TeacherUserFactory()
        client = _login(teacher_user.username)
        response = client.get("/api/payments/")
        assert response.status_code == 403

    def test_student_cannot_access_payment_list(self):
        """Students must receive 403 on GET /api/payments/."""
        student_user = StudentUserFactory()
        client = _login(student_user.username)
        response = client.get("/api/payments/")
        assert response.status_code == 403
