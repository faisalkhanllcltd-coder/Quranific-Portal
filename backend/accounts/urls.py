from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    CustomTokenObtainPairView, 
    RegisterView, 
    TeacherViewSet,
    SystemAccessViewSet,
    PayrollViewSet,
    ChangePasswordView,
    MyProfileView,
    ParentRegistrationView,
    LogoutView,
    ParentListView,  # A-P3-01: scoped parent dropdown endpoint
)

# RATE LIMIT (A-P1-06): Wrap TokenRefreshView so /login/refresh/ also gets
# the 'auth' scope throttle (5/minute per IP). A subclass is the cleanest
# approach — no changes to the simplejwt library required.
class ThrottledTokenRefreshView(TokenRefreshView):
    throttle_scope = 'auth'


# Create a Router for the ViewSets
router = DefaultRouter()

# These endpoints will be: /api/accounts/teachers/, /api/accounts/system-access/, etc.
router.register(r'teachers', TeacherViewSet, basename='teacher')
router.register(r'system-access', SystemAccessViewSet, basename='system-access')
router.register(r'payroll', PayrollViewSet, basename='payroll')

urlpatterns = [
    # 1. Login (Get Token)
    path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    
    # 2. Refresh Token — RATE LIMIT: ThrottledTokenRefreshView applies 'auth' scope (5/min)
    path('login/refresh/', ThrottledTokenRefreshView.as_view(), name='token_refresh'),
    
    # 3. Register New User
    path('register/', RegisterView.as_view(), name='auth_register'),

    # 4. Change Password (For any authenticated user)
    path('change-password/', ChangePasswordView.as_view(), name='change_password'),

    # 5. My Profile (For updating personal info)
    path('me/', MyProfileView.as_view(), name='my_profile'),

    # 6. Parent Registration (Owner/Manager Only)
    path('register-parent/', ParentRegistrationView.as_view(), name='register_parent'),

    # 7. Logout (Blacklists refresh token server-side — A-P1-03 fix)
    path('logout/', LogoutView.as_view(), name='logout'),

    # 8. Parent list for enrollment dropdown (A-P3-01: replaces system-access/ for this use case)
    path('parents/', ParentListView.as_view(), name='parent_list'),

    # 9. Include the Router 
    path('', include(router.urls)),
]