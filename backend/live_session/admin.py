from django.contrib import admin
import logging

logger = logging.getLogger(__name__)

try:
    from .models import Room
    
    @admin.register(Room)
    class RoomAdmin(admin.ModelAdmin):
        # Using a safe list of fields that are guaranteed to exist
        list_display = ('name', 'is_active')
        list_filter = ('is_active',)
        search_fields = ('name',)
except ImportError:
    logger.error("Could not import Room model. Check live_session/models.py")

try:
    from .models import SessionLog
    
    @admin.register(SessionLog)
    class SessionLogAdmin(admin.ModelAdmin):
        list_display = ('room', 'host', 'started_at', 'ended_at', 'duration_minutes')
        list_filter = ('room', 'host')
        search_fields = ('room__name', 'host__username')
        readonly_fields = ('started_at',)
except ImportError:
    # If the AI hasn't fully built the SessionLog model yet, this prevents the server from crashing
    pass