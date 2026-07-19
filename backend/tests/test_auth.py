"""
tests/test_auth.py — Authentication flow tests.

Covers: login/token issuance, invalid credentials rejection, token refresh,
logout/blacklist (A-P1-03), unauthenticated access rejection, and the
A-P1-01 regression: no role override for the 'quranific' username.

All tests use @pytest.mark.django_db and the real Postgres test DB.
"""
import pytest
from rest_framework.test import APIClient
from tests.factories import OwnerUserFactory, StudentUserFactory


@pytest.mark.django_db
class TestLogin:
    """POST /api/accounts/login/"""

    def test_valid_credentials_returns_access_and_refresh_tokens(self):
        """A correct username+password returns 200 with both JWT tokens."""
        user = StudentUserFactory()
        client = APIClient()
        response = client.post(
            "/api/accounts/login/",
            {"username": user.username, "password": "TestPass123!"},
            format="json",
        )
        assert response.status_code == 200
        assert "access" in response.data
        assert "refresh" in response.data

    def test_wrong_password_returns_401(self):
        """A valid username with the wrong password must be rejected with 401."""
        user = StudentUserFactory()
        client = APIClient()
        response = client.post(
            "/api/accounts/login/",
            {"username": user.username, "password": "WrongPassword!"},
            format="json",
        )
        assert response.status_code == 401
        assert "access" not in response.data

    def test_nonexistent_user_returns_401(self):
        """A username that does not exist must be rejected with 401."""
        client = APIClient()
        response = client.post(
            "/api/accounts/login/",
            {"username": "nobody_exists_xyz", "password": "AnyPassword!"},
            format="json",
        )
        assert response.status_code == 401

    def test_missing_password_field_returns_400(self):
        """Login with no password field should return 400, not a server error."""
        user = StudentUserFactory()
        client = APIClient()
        response = client.post(
            "/api/accounts/login/",
            {"username": user.username},
            format="json",
        )
        assert response.status_code == 400


@pytest.mark.django_db
class TestTokenRefresh:
    """POST /api/accounts/login/refresh/"""

    def test_valid_refresh_token_returns_new_access_token(self):
        """A fresh refresh token must exchange for a new access token."""
        user = StudentUserFactory()
        client = APIClient()
        login = client.post(
            "/api/accounts/login/",
            {"username": user.username, "password": "TestPass123!"},
            format="json",
        )
        refresh = login.data["refresh"]
        response = client.post(
            "/api/accounts/login/refresh/",
            {"refresh": refresh},
            format="json",
        )
        assert response.status_code == 200
        assert "access" in response.data


@pytest.mark.django_db
class TestLogout:
    """POST /api/accounts/logout/ — A-P1-03: JWT blacklist on logout."""

    def test_logout_returns_205_and_blacklists_refresh_token(self):
        """
        Logging out must return 205 and the same refresh token must then
        be rejected on subsequent refresh attempts (blacklisted).

        Regression for A-P1-03: before the fix, logout was a no-op and
        existing refresh tokens remained valid indefinitely.
        """
        user = StudentUserFactory()
        client = APIClient()
        login = client.post(
            "/api/accounts/login/",
            {"username": user.username, "password": "TestPass123!"},
            format="json",
        )
        access = login.data["access"]
        refresh = login.data["refresh"]

        # Logout with the refresh token
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        logout_response = client.post(
            "/api/accounts/logout/",
            {"refresh": refresh},
            format="json",
        )
        assert logout_response.status_code == 205

        # Attempting to reuse the same refresh token must now fail
        replay_response = client.post(
            "/api/accounts/login/refresh/",
            {"refresh": refresh},
            format="json",
        )
        assert replay_response.status_code == 401, (
            "Blacklisted refresh token was still accepted after logout — "
            "A-P1-03 regression."
        )


@pytest.mark.django_db
class TestUnauthenticatedAccess:
    """Protected endpoints must reject unauthenticated requests."""

    def test_students_list_requires_authentication(self):
        """GET /api/students/ without a token must return 401."""
        client = APIClient()
        response = client.get("/api/students/")
        assert response.status_code == 401

    def test_payments_list_requires_authentication(self):
        """GET /api/payments/ without a token must return 401."""
        client = APIClient()
        response = client.get("/api/payments/")
        assert response.status_code == 401


@pytest.mark.django_db
class TestRoleOverrideRegression:
    """
    A-P1-01 REGRESSION: Username 'quranific' must not grant elevated privileges.

    Before A-P1-01, Login.jsx contained a client-side backdoor:
        if (userData.username === 'quranific') userData.user_type = 'owner';
    That was removed. On the backend, a user named 'quranific' with role
    'student' must still receive a 403 on owner-only endpoints.

    This test verifies the backend RBAC is enforced server-side regardless of
    what any client-side code says about the username.
    """

    def test_quranific_username_with_student_role_cannot_access_system_access(self):
        """
        A user named 'quranific' whose Profile.user_type is 'student' must
        receive 403 on GET /api/accounts/system-access/ (IsOwner gate).
        """
        # Create a user literally named 'quranific' with the student role
        from django.contrib.auth.models import User
        from tests.factories import StudentUserFactory

        user = StudentUserFactory()
        user.username = "quranific"
        user.save(update_fields=["username"])

        client = APIClient()
        login = client.post(
            "/api/accounts/login/",
            {"username": "quranific", "password": "TestPass123!"},
            format="json",
        )
        assert login.status_code == 200, "Login itself should succeed"
        access = login.data["access"]

        client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        response = client.get("/api/accounts/system-access/")
        assert response.status_code == 403, (
            "User 'quranific' with role 'student' was granted access to "
            "/api/accounts/system-access/ — A-P1-01 regression detected."
        )
