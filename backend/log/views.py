from rest_framework import viewsets, permissions
from .models import SystemLog
from .serializers import SystemLogSerializer
from accounts.views import IsOwner


class SystemLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    SECURED: Only owners can view the full system audit trail.
    Previously accessible to all authenticated users (students, teachers).
    """
    queryset = SystemLog.objects.all().select_related('user')
    serializer_class = SystemLogSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]