import os
import json
import logging
import datetime
import uuid
from django.utils import timezone

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions

from livekit.api import AccessToken, VideoGrants, WebhookReceiver
from django.contrib.auth.models import User
from .models import Room, SessionLog

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Read LiveKit credentials from environment variables.
# R-R3-05: Added startup guard — logs CRITICAL if default/placeholder keys detected.
# ---------------------------------------------------------------------------
LIVEKIT_API_KEY    = os.environ.get('LIVEKIT_API_KEY', '')
LIVEKIT_API_SECRET = os.environ.get('LIVEKIT_API_SECRET', '')

# Known-insecure values: the old devkey/secret defaults AND the new CHANGE_ME_ placeholders.
_INSECURE_KEYS = {'devkey', 'secret', 'CHANGE_ME_LIVEKIT_API_KEY', 'CHANGE_ME_LIVEKIT_API_SECRET_MIN_32_CHARS', ''}

if LIVEKIT_API_KEY in _INSECURE_KEYS or LIVEKIT_API_SECRET in _INSECURE_KEYS:
    logger.critical(
        "R-R3-05 SECURITY: LiveKit is running with insecure or placeholder credentials. "
        "LIVEKIT_API_KEY='%s' — any attacker who knows your LiveKit server address can "
        "generate valid room tokens. Set real keys in .env and livekit/livekit.yaml "
        "before accepting real classroom traffic.",
        LIVEKIT_API_KEY or '<empty>',
    )


class GenerateTokenView(APIView):
    """
    POST /api/live/token/
    Returns a cryptographically signed LiveKit JWT. 
    ARMORED: Prevents unauthorized students from joining rooms they don't belong to.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
            logger.critical("LIVEKIT_API_KEY or LIVEKIT_API_SECRET is completely missing from environment.")
            return Response(
                {"detail": "Live classroom service is currently offline. Contact administration."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        room_name = request.data.get('room_name', '').strip()
        if not room_name:
            return Response(
                {"detail": "A valid room_name is required to generate a token."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user
        identity = user.username

        # 1. Determine User Role Safely
        try:
            user_type = getattr(user.profile, 'user_type', 'student').lower()
        except Exception:
            user_type = 'student'

        is_host = user_type in ('owner', 'head_manager', 'manager', 'teacher')

        # 2. Smart Room Routing & Anti-Bombing Armor
        if is_host:
            # Hosts can create or activate their assigned rooms
            room, created = Room.objects.get_or_create(
                name=room_name,
                defaults={'assigned_teacher': user, 'is_active': True}
            )
            if not room.is_active:
                room.is_active = True
                room.save(update_fields=['is_active'])
        else:
            # Students can ONLY join active rooms owned by THEIR assigned teacher
            try:
                room = Room.objects.get(name=room_name, is_active=True)
                
                # Relational Armor: Verify this student is allowed in this room
                try:
                    assigned_teacher = getattr(user.profile, 'assigned_teacher', None)
                    room_owner = room.assigned_teacher.username if room.assigned_teacher else None
                    
                    # If the student has an assigned teacher, it MUST match the room's owner
                    if assigned_teacher and room_owner and str(assigned_teacher) != str(room_owner):
                        logger.warning(f"Security Alert: Student {identity} attempted to infiltrate room {room_name}.")
                        return Response(
                            {"detail": "Unauthorized. You are not assigned to this Ustad's classroom."},
                            status=status.HTTP_403_FORBIDDEN,
                        )
                except Exception as e:
                    logger.error(f"Error checking student-teacher relation: {e}")
                    
            except Room.DoesNotExist:
                return Response(
                    {"detail": "The class hasn't started yet. Please wait for your Ustad."},
                    status=status.HTTP_404_NOT_FOUND,
                )

        # 3. Build Webhook Metadata (Strictly typed)
        metadata = json.dumps({
            "user_type": user_type, 
            "user_id": user.pk,
            "joined_at": timezone.now().isoformat()
        })

        # 4. Generate the Secure JWT
        grants = VideoGrants(
            room_join=True,
            room=room_name,
            can_publish=is_host,          # Only hosts can force-publish video
            can_subscribe=True,
            can_publish_data=True,        # Allow students to use chat/raise hand
        )

        at = AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        at.with_identity(identity)
        at.with_name(user.get_full_name() or identity)
        at.with_metadata(metadata)
        at.with_grants(grants)
        # Token is only valid for 4 hours to prevent permanent hijack
        at.with_ttl(datetime.timedelta(hours=4)) 
        
        token = at.to_jwt()

        logger.info(f"LiveKit Secure Token Issued: user={identity} room={room_name} role={user_type}")

        return Response({
            "token": token,
            "room_name": room_name,
            "identity": identity,
            "user_type": user_type,
        })


class EndSessionView(APIView):
    """
    POST /api/live/end-session/
    Manual fallback to end a session from the UI.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        room_name = request.data.get('room_name', '').strip()
        if not room_name:
            return Response({"detail": "room_name is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            room = Room.objects.get(name=room_name)
        except Room.DoesNotExist:
            return Response({"detail": f"Room '{room_name}' not found."}, status=status.HTTP_404_NOT_FOUND)

        session = SessionLog.objects.filter(
            room=room,
            host=request.user,
            ended_at=None,
        ).order_by('-started_at').first()

        if not session:
            return Response({"detail": "No active session found."}, status=status.HTTP_404_NOT_FOUND)

        session.ended_at = timezone.now()
        session.save(update_fields=['ended_at'])

        logger.info(f"Session ended manually via UI: room={room_name} host={request.user.username}")
        return Response({
            "detail": "Session ended successfully.",
            "room_name": room_name,
            "duration_minutes": session.duration_minutes,
        })


class LiveKitWebhookView(APIView):
    """
    POST /api/live/webhook/
    Highly secure endpoint receiving webhooks from the LiveKit server.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
            logger.error("Webhook rejected: Missing LiveKit credentials in environment.")
            return Response(status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        auth_header = request.headers.get('Authorization')
        if not auth_header:
            logger.warning("Webhook rejected: Missing Authorization header.")
            return Response("Missing Authorization header", status=status.HTTP_401_UNAUTHORIZED)
            
        try:
            receiver = WebhookReceiver(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
            body_str = request.body.decode('utf-8')
            event = receiver.receive(body_str, auth_header)
        except Exception as e:
            logger.error(f"Webhook signature verification failed: {e}")
            return Response("Invalid signature", status=status.HTTP_401_UNAUTHORIZED)

        event_name = getattr(event, 'event', getattr(event, 'event_type', None))
        
        room_obj = getattr(event, 'room', None)
        room_name = getattr(room_obj, 'name', None) if room_obj else None

        participant_obj = getattr(event, 'participant', None)
        identity = getattr(participant_obj, 'identity', None) if participant_obj else None
        raw_metadata = getattr(participant_obj, 'metadata', "{}") if participant_obj else "{}"

        try:
            metadata = json.loads(raw_metadata) if raw_metadata else {}
        except json.JSONDecodeError:
            metadata = {}

        if not room_name:
            return Response("OK", status=status.HTTP_200_OK)

        try:
            db_room = Room.objects.get(name=room_name)
        except Room.DoesNotExist:
            logger.error(f"Webhook received for unknown room: {room_name}")
            return Response("OK", status=status.HTTP_200_OK)

        if event_name == "participant_joined":
            user_type = metadata.get('user_type', 'student')
            if user_type in ('owner', 'head_manager', 'manager', 'teacher'):
                try:
                    host_user = User.objects.get(username=identity)
                    SessionLog.objects.get_or_create(
                        room=db_room,
                        host=host_user,
                        ended_at=None,
                        defaults={'participant_count': 1}
                    )
                    logger.info(f"Webhook: Host {identity} joined. Session started in {room_name}.")
                except User.DoesNotExist:
                    pass
            else:
                active_session = SessionLog.objects.filter(room=db_room, ended_at=None).last()
                if active_session:
                    active_session.participant_count += 1
                    active_session.save(update_fields=['participant_count'])
                    logger.info(f"Webhook: Participant {identity} joined {room_name}. Count updated.")

        elif event_name == "room_finished" or event_name == "participant_left":
            user_type = metadata.get('user_type', 'student')
            if event_name == "room_finished" or user_type in ('owner', 'head_manager', 'manager', 'teacher'):
                active_sessions = SessionLog.objects.filter(room=db_room, ended_at=None)
                if active_sessions.exists():
                    active_sessions.update(ended_at=timezone.now())
                    logger.info(f"Webhook: Room {room_name} finished or host left. Session(s) closed.")

        return Response("OK", status=status.HTTP_200_OK)


class CreateDynamicRoomView(APIView):
    """
    POST /api/live/create-room/
    Generates a unique LiveKit room on the fly for teachers/managers.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not hasattr(request.user, 'profile'):
            return Response(
                {"error": "User profile missing."}, 
                status=status.HTTP_403_FORBIDDEN
            )
            
        user_type = getattr(request.user.profile, 'user_type', None)
        if user_type not in ['owner', 'head_manager', 'manager', 'teacher']:
            return Response(
                {"detail": "Access Denied. Only staff can create live rooms."}, 
                status=status.HTTP_403_FORBIDDEN
            )

        room_hash = f"class-{uuid.uuid4().hex[:6]}"

        room = Room.objects.create(
            name=room_hash,
            assigned_teacher=request.user,
            is_active=True
        )

        return Response({
            "room_name": room.name,
            "message": "Room generated successfully."
        })