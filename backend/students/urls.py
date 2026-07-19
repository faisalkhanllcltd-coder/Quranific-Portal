from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    StudentViewSet, AttendanceViewSet,
    AssignmentViewSet, SubmissionViewSet, StudyMaterialViewSet
)

router = DefaultRouter()
router.register(r'students', StudentViewSet, basename='student')
router.register(r'attendance', AttendanceViewSet, basename='attendance')

# New LMS Routes
router.register(r'assignments', AssignmentViewSet, basename='assignment')
router.register(r'submissions', SubmissionViewSet, basename='submission')
router.register(r'materials', StudyMaterialViewSet, basename='studymaterial')

urlpatterns = [
    path('', include(router.urls)),
]