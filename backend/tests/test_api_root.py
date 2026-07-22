import pytest
from django.urls import reverse
from rest_framework import status

@pytest.mark.django_db
class TestAPIRoot:
    def test_drf_api_root_loads_without_crash(self):
        """
        Regression test for A-P6-11:
        Verify that hitting the DRF APIRoot view does not crash.
        Previously, missing app_name='live_session' in live_session/urls.py
        caused an AttributeError/TemplateSyntaxError when DRF tried to build
        the browsable API root page for the registered namespaces.
        """
        from rest_framework.test import APIClient
        client = APIClient()
        
        # Authenticate to avoid 401 Unauthorized, ensuring the browsable API HTML renders
        # which is where the TemplateSyntaxError would occur if namespace was missing.
        from django.contrib.auth import get_user_model
        User = get_user_model()
        user = User.objects.create_user(username='api_test_user', password='Password123')
        client.force_authenticate(user=user)

        url = '/api/'
        response = client.get(url, HTTP_ACCEPT='text/html') # Request HTML to trigger browsable API render
        assert response.status_code == status.HTTP_200_OK
