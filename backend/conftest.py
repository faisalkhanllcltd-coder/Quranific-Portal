"""
conftest.py — Shared pytest fixtures for the Quranific Portal test suite.

All fixtures that need DB access accept the built-in `db` fixture as a
parameter — this is the correct pytest-django pattern for pytest 8.x.
@pytest.mark.django_db must NOT be applied to fixtures (deprecated in 8.x).

DB: Uses the real Postgres service configured in config/settings.py.
    pytest-django creates and destroys `test_<POSTGRES_DB>` automatically.
    Never touches the real database.
"""
import pytest
from rest_framework.test import APIClient

from tests.factories import (
    OwnerUserFactory,
    HeadManagerUserFactory,
    ManagerUserFactory,
    TeacherUserFactory,
    StudentUserFactory,
    ParentUserFactory,
    StudentFactory,
    PaymentFactory,
    AttendanceFactory,
)


# ─────────────────────────────────────────────────────────────────────────────
# Base client
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def api_client():
    """Unauthenticated DRF APIClient. No DB access needed."""
    return APIClient()


# ─────────────────────────────────────────────────────────────────────────────
# Throttle suppression (autouse — applied to every test automatically)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def disable_throttling(settings):
    """
    Zero all DRF throttle rates for every test.

    The auth throttle (5/min per IP — A-P1-06) is correct production behaviour
    but tests run sequentially from 127.0.0.1 and exhaust the rate limit by
    test 6, causing 429 on all subsequent login attempts.

    pytest-django's `settings` fixture patches Django settings for the
    duration of a single test and restores them afterwards — no side effects.
    This does NOT disable throttle testing; add explicit throttle tests in a
    dedicated class that removes this fixture via `@pytest.mark.usefixtures`
    override if needed in future.
    """
    settings.REST_FRAMEWORK = {
        **settings.REST_FRAMEWORK,
        'DEFAULT_THROTTLE_CLASSES': [],
        'DEFAULT_THROTTLE_RATES': {},
    }


def _get_token(username, password="TestPass123!"):
    """POST to login and return the access token string."""
    client = APIClient()
    response = client.post(
        "/api/accounts/login/",
        {"username": username, "password": password},
        format="json",
    )
    assert response.status_code == 200, (
        f"Login failed for '{username}': {response.status_code} — {response.data}"
    )
    return response.data["access"]


# ─────────────────────────────────────────────────────────────────────────────
# Role-specific authenticated client fixtures
# Each accepts `db` so pytest-django grants DB access via fixture dependency,
# not via @pytest.mark.django_db on the fixture itself (disallowed in 8.x).
# Returns (APIClient, User) tuple.
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def owner_client(db):
    user = OwnerUserFactory()
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {_get_token(user.username)}")
    return client, user


@pytest.fixture
def head_manager_client(db):
    user = HeadManagerUserFactory()
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {_get_token(user.username)}")
    return client, user


@pytest.fixture
def manager_client(db):
    user = ManagerUserFactory()
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {_get_token(user.username)}")
    return client, user


@pytest.fixture
def teacher_client(db):
    user = TeacherUserFactory()
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {_get_token(user.username)}")
    return client, user


@pytest.fixture
def student_client(db):
    user = StudentUserFactory()
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {_get_token(user.username)}")
    return client, user


@pytest.fixture
def parent_client(db):
    user = ParentUserFactory()
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {_get_token(user.username)}")
    return client, user


# ─────────────────────────────────────────────────────────────────────────────
# Shared model fixtures — all accept `db` for DB access
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def student(db):
    """A basic Student object reusable across test modules."""
    return StudentFactory()


@pytest.fixture
def student_with_parent(db):
    """A Student linked to a real parent User account. Returns (Student, User)."""
    parent_user = ParentUserFactory()
    return StudentFactory(parent_account=parent_user), parent_user


@pytest.fixture
def payment(db, student):
    """A single Payment for month 2026-07, linked to the shared student fixture."""
    return PaymentFactory(student=student, month_paid_for="2026-07")
