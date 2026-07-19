"""
URL configuration for config project.
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from log.views import SystemLogViewSet

# Create a router specifically for ViewSets like the logs
router = DefaultRouter()
router.register(r'logs', SystemLogViewSet, basename='system-log')

urlpatterns = [
    path('admin/', admin.site.urls),

    # 1. User Accounts (Login, Register, Teachers, Payroll)
    # Result: http://127.0.0.1:8000/api/accounts/login/
    path('api/accounts/', include('accounts.urls')),

    # 2. Financial Engine (2Checkout Webhooks & Ledger)
    # Result: http://127.0.0.1:8000/api/payments/
    #         http://127.0.0.1:8000/api/payments/webhook/2checkout/
    # *Note: Placed above generic 'api/' to prevent URL shadowing.
    path('api/payments/', include('payments.urls')),

    # 3. Students & Centralized Attendance
    # Result: http://127.0.0.1:8000/api/students/
    #         http://127.0.0.1:8000/api/attendance/
    path('api/', include('students.urls')),

    # 4. Live Classroom (LiveKit)
    # Result: http://127.0.0.1:8000/api/live/token/
    #         http://127.0.0.1:8000/api/live/end-session/
    path('api/live/', include('live_session.urls')),

    # 5. System Logs
    # Result: http://127.0.0.1:8000/api/logs/
    path('api/', include(router.urls)),
]