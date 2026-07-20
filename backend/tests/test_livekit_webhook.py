import pytest
from unittest.mock import patch
from rest_framework.test import APIClient
from live_session.models import SessionLog

@pytest.mark.django_db
class TestLiveKitWebhook:
    @patch('live_session.views.LIVEKIT_API_KEY', 'test_key')
    @patch('live_session.views.LIVEKIT_API_SECRET', 'test_secret')
    def test_missing_or_invalid_signature_rejects_before_db_write(self):
        client = APIClient()
        
        initial_log_count = SessionLog.objects.count()
        
        payload = {
            "event": "participant_joined",
            "room": {"name": "test-room"},
            "participant": {
                "identity": "some_user",
                "metadata": "{\"user_type\": \"student\"}"
            }
        }
        
        # Missing Authorization Header
        response = client.post("/api/live/webhook/", payload, format="json")
        assert response.status_code == 401
        
        # Invalid Authorization Header (Valid structure, bad token)
        response = client.post(
            "/api/live/webhook/", 
            payload, 
            format="json",
            HTTP_AUTHORIZATION="Bearer invalid_token_here"
        )
        assert response.status_code == 401
        
        # Structurally broken Authorization Header
        response = client.post(
            "/api/live/webhook/", 
            payload, 
            format="json",
            HTTP_AUTHORIZATION="not-a-bearer-token-at-all"
        )
        assert response.status_code == 401
        
        # Ensure DB was completely untouched
        assert SessionLog.objects.count() == initial_log_count
