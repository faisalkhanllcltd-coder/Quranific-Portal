"""
live_session — Models
=====================
Room        : A named LiveKit room tied to a teacher.
SessionLog  : An immutable record of every class session (start/end times,
              participants) for audit and payroll calculations.
"""

from django.db import models
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver
from accounts.models import TeacherProfile


class Room(models.Model):
    """
    Represents a persistent LiveKit room configuration.
    Each room is assigned to one teacher ("host"). The room name is used
    as the LiveKit room identifier when generating join tokens.
    """

    name = models.CharField(
        max_length=120,
        unique=True,
        help_text="Must match the LiveKit room name used in token grants."
    )
    assigned_teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='livekit_rooms',
        help_text="Teacher (Ustad) who hosts classes in this room."
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Deactivated rooms are hidden from the UI and reject new tokens."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'LiveKit Room'
        verbose_name_plural = 'LiveKit Rooms'

    def __str__(self):
        teacher_name = self.assigned_teacher.username if self.assigned_teacher else 'Unassigned'
        return f"{self.name} ({teacher_name})"


class SessionLog(models.Model):
    """
    Immutable audit record of a live classroom session.
    Created when a teacher starts a class, updated when it ends.
    Used downstream for:
      - Payroll (hourly teacher compensation)
      - Attendance verification
      - Quality analytics
    """

    room = models.ForeignKey(
        Room,
        on_delete=models.CASCADE,
        related_name='sessions',
        help_text="The room this session took place in."
    )
    host = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='hosted_sessions',
        help_text="The teacher who started this session."
    )

    started_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Timestamp when the teacher joined / started the class."
    )
    ended_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp when the session was closed. Null = still running."
    )

    participant_count = models.PositiveIntegerField(
        default=0,
        help_text="Peak number of students who joined this session."
    )
    notes = models.TextField(
        blank=True,
        help_text="Optional notes or topics covered during the session."
    )

    class Meta:
        ordering = ['-started_at']
        verbose_name = 'Session Log'
        verbose_name_plural = 'Session Logs'

    def __str__(self):
        host_name = self.host.username if self.host else 'Unknown'
        return f"{self.room.name} — {host_name} @ {self.started_at:%Y-%m-%d %H:%M}"

    @property
    def is_active(self):
        """True if the session has not yet ended."""
        return self.ended_at is None

    @property
    def duration_minutes(self):
        """Duration in minutes. Returns None if the session is still live."""
        if self.ended_at is None:
            return None
        delta = self.ended_at - self.started_at
        return round(delta.total_seconds() / 60, 1)


# ---------------------------------------------------------------------------
# AUTO-CREATE LIVEKIT ROOM FOR TEACHERS
# ---------------------------------------------------------------------------
@receiver(post_save, sender=TeacherProfile)
def create_room_for_new_teacher(sender, instance, **kwargs):
    """
    When a TeacherProfile is created/saved, ensure they have a persistent
    LiveKit Room assigned to them.
    Room name format: room_<username>
    """
    user = instance.profile.user
    sanitized_username = "".join(c for c in user.username if c.isalnum() or c in "-_")
    room_name = f"room_{sanitized_username}"
    
    Room.objects.get_or_create(
        name=room_name,
        defaults={'assigned_teacher': user, 'is_active': True}
    )

