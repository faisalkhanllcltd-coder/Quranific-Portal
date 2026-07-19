"""
live_session — URL Configuration
=================================
"""

from django.urls import path
from .views import GenerateTokenView, EndSessionView, LiveKitWebhookView, CreateDynamicRoomView

urlpatterns = [
    # POST /api/live/token/       — Get a LiveKit JWT to join a room
    path('token/', GenerateTokenView.as_view(), name='livekit-token'),

    # POST /api/live/end-session/ — Teacher closes the active session
    path('end-session/', EndSessionView.as_view(), name='livekit-end-session'),

    # POST /api/live/webhook/     — LiveKit server sends events here securely
    path('webhook/', LiveKitWebhookView.as_view(), name='livekit-webhook'),

    # POST /api/live/create-room/ — Securely generate a new class on the fly
    path('create-room/', CreateDynamicRoomView.as_view(), name='create-room'),
]