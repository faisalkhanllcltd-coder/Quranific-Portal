import pytest
from rest_framework import status
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model

@pytest.mark.django_db
class TestLiveSessionAPI:
    def test_live_session_browsable_api_renders_without_crash(self):
        """
        Regression test for A-P6-11:
        Verify that hitting a live_session endpoint in the DRF Browsable API 
        does not crash. Previously, missing app_name='live_session' in live_session/urls.py
        caused an AttributeError/TemplateSyntaxError when DRF tried to build
        breadcrumbs and resolve namespaces for the HTML browsable API.
        """
        client = APIClient()
        User = get_user_model()
        user = User.objects.create_user(username='api_test_user', password='Password123')
        client.force_authenticate(user=user)

        # Hitting a live_session endpoint directly requesting HTML 
        # forces the BrowsableAPIRenderer to evaluate the namespace/breadcrumbs.
        url = '/api/live/token/'
        response = client.get(url, HTTP_ACCEPT='text/html')
        
        # 405 Method Not Allowed is perfectly fine here (Token view is POST-only),
        # as long as it's not a 500 crash from TemplateSyntaxError/AttributeError.
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_405_METHOD_NOT_ALLOWED]
