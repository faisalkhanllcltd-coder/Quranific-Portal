from django.contrib import admin
from .models import SystemLog


@admin.register(SystemLog)
class SystemLogAdmin(admin.ModelAdmin):
    list_display = ('action', 'user', 'timestamp', 'details')
    list_filter = ('action', 'timestamp')
    search_fields = ('user__username', 'details', 'action')
    readonly_fields = ('action', 'user', 'timestamp', 'details')
    date_hierarchy = 'timestamp'
    ordering = ('-timestamp',)

    def has_add_permission(self, request):
        """Logs are system-generated only — block manual creation via admin."""
        return False

    def has_change_permission(self, request, obj=None):
        """Logs are immutable audit records — block edits via admin."""
        return False

    def has_delete_permission(self, request, obj=None):
        """Only superusers may purge logs."""
        return request.user.is_superuser
