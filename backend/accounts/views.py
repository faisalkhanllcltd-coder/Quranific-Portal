import logging
from decimal import Decimal

from django.shortcuts import render
from django.db import transaction
from django.db.models import Count
from rest_framework import generics, viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated, BasePermission
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination  # A-P4-01: SystemAccessViewSet pagination
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
from django.contrib.auth.models import User
from .models import Profile, TeacherProfile

from .serializers import (
    UserSerializer,
    CustomTokenObtainPairSerializer,
    TeacherListSerializer,
    TeacherPublicSerializer,
    RegisterSerializer
)

logger = logging.getLogger(__name__)


# ==========================================
# 🛡️ THE SECURITY GUARDS (Custom Permissions)
# ==========================================

class IsOwner(BasePermission):
    """
    Strict Firewall: Allows access ONLY to users with the 'owner' user_type.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        # SECURITY FIX: Hardcoded backdoor removed. Rely strictly on roles and superuser flag.
        if request.user.is_superuser:
            return True
        try:
            return request.user.profile.user_type == 'owner'
        except Profile.DoesNotExist:
            return False


class IsOwnerOrManager(BasePermission):
    """
    Allows access to owner, head_manager, and manager roles.
    Used for student/staff management endpoints.
    """
    ALLOWED_TYPES = ('owner', 'head_manager', 'manager')

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        try:
            return request.user.profile.user_type in self.ALLOWED_TYPES
        except Profile.DoesNotExist:
            return False


class IsOwnerOrHeadManager(BasePermission):
    """
    A-P8-02 — CAPABILITY SPLIT: Allows access to owner and head_manager only.
    Excludes plain 'manager' role.

    Apply to destructive or high-privilege operations where a plain manager
    should not have access:
      - Deleting students (StudentViewSet.destroy)
      - Force-resetting student login credentials (update_credentials)

    Permission hierarchy (most → least privileged):
      IsOwner           → owner only
      IsOwnerOrHeadManager → owner, head_manager
      IsOwnerOrManager  → owner, head_manager, manager  (standard admin ops)
      IsStaffOrTeacher  → all of the above + teacher
      IsAuthenticated   → all logged-in users
    """
    ALLOWED_TYPES = ('owner', 'head_manager')

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        try:
            return request.user.profile.user_type in self.ALLOWED_TYPES
        except Profile.DoesNotExist:
            return False


class IsStaffOrTeacher(BasePermission):
    """
    Allows access to owner, head_manager, manager, and teacher roles.
    Students are explicitly denied. Used for attendance marking and
    student list viewing.
    """
    ALLOWED_TYPES = ('owner', 'head_manager', 'manager', 'teacher')

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        try:
            return request.user.profile.user_type in self.ALLOWED_TYPES
        except Profile.DoesNotExist:
            return False


# ==========================================
# ⚙️ CORE AUTH VIEWS
# ==========================================

class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Login endpoint. RATE LIMIT (A-P1-06): 5 attempts per minute per IP.
    Brute-force is blocked at the DRF throttle layer before credentials are checked.
    """
    serializer_class = CustomTokenObtainPairSerializer
    throttle_scope = 'auth'


class RegisterView(generics.CreateAPIView):
    """
    SECURED: Only authenticated owners/managers can register new users.
    This prevents anonymous account creation and user_type escalation.
    RATE LIMIT (A-P1-06): 10 registrations per hour per IP (account farming protection).
    """
    queryset = User.objects.all()
    permission_classes = [IsAuthenticated, IsOwnerOrManager]
    serializer_class = RegisterSerializer
    throttle_scope = 'register'


class ParentRegistrationView(APIView):
    """
    PHASE 3: Generates a parent account so they can be linked to multiple children.
    Only Owner or Manager can trigger this.
    """
    permission_classes = [IsAuthenticated, IsOwnerOrManager]

    @transaction.atomic
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        email = request.data.get('email', '')
        first_name = request.data.get('first_name', '')
        last_name = request.data.get('last_name', '')

        if not username or not password:
            return Response({"error": "Username and password are required."}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(username=username).exists():
            return Response({"error": "Username is already taken."}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(
            username=username,
            password=password,
            email=email,
            first_name=first_name,
            last_name=last_name
        )

        # Force the profile to be 'parent'
        profile, created = Profile.objects.get_or_create(user=user)
        profile.user_type = 'parent'
        profile.save(update_fields=['user_type'])

        return Response({
            "message": "Parent account created successfully.",
            "parent_id": user.id,
            "username": user.username
        }, status=status.HTTP_201_CREATED)


class MyProfileView(APIView):
    """
    SECURED: Allows any authenticated user to GET and PATCH their own profile data.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        profile, _ = Profile.objects.get_or_create(user=user)
        data = {
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'email': user.email,
            'whatsapp': profile.whatsapp_number,
            'bio': profile.bio,
            'user_type': profile.user_type
        }
        return Response(data, status=status.HTTP_200_OK)

    @transaction.atomic
    def patch(self, request):
        allowed_fields = {'first_name', 'last_name', 'email', 'whatsapp', 'bio'}
        provided_fields = set(request.data.keys())
        invalid_fields = provided_fields - allowed_fields

        if invalid_fields:
            return Response(
                {"error": f"Invalid fields in payload. Allowed: {', '.join(sorted(allowed_fields))}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = request.user
        profile, _ = Profile.objects.get_or_create(user=user)

        user.first_name = request.data.get('first_name', user.first_name)
        user.last_name = request.data.get('last_name', user.last_name)
        user.email = request.data.get('email', user.email)
        user.save(update_fields=['first_name', 'last_name', 'email'])

        profile.whatsapp_number = request.data.get('whatsapp', profile.whatsapp_number)
        profile.bio = request.data.get('bio', profile.bio)
        profile.save(update_fields=['whatsapp_number', 'bio'])

        return Response({"message": "Profile updated successfully."}, status=status.HTTP_200_OK)


class ChangePasswordView(APIView):
    """
    SECURED: Allows any authenticated user to securely change their own password.
    Requires the old password to prove identity.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')

        if not old_password or not new_password:
            return Response(
                {'error': 'Both old password and new password are required.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        if not user.check_password(old_password):
            return Response(
                {'error': 'Incorrect current password.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # Set and hash the new password securely
        user.set_password(new_password)
        user.save()
        
        logger.info(f"User {user.username} successfully changed their password.")
        return Response({'message': 'Password updated successfully.'}, status=status.HTTP_200_OK)


# ==========================================
# 👨‍👩‍👧 PARENT LIST (for enrollment dropdown)
# ==========================================
class ParentListView(APIView):
    """
    GET /api/accounts/parents/
    Returns a minimal, safe list of registered parent accounts for use in
    the Student enrollment form's 'Link Existing Parent' dropdown.

    BUG FIX (A-P3-01): StudentList.jsx was calling accounts/system-access/
    which is IsOwner-only. head_manager and manager received a 403, making
    the parent dropdown permanently empty for them.

    This endpoint:
    - Is accessible to ALL admin roles (IsOwnerOrManager)
    - Returns ONLY parent-role users (DB-filtered, not Python-filtered)
    - Exposes ONLY safe fields: id, username, first_name, last_name
    - Does NOT expose email, is_active, role, or any other sensitive data
    """
    permission_classes = [IsAuthenticated, IsOwnerOrManager]

    def get(self, request):
        parents = User.objects.filter(
            profile__user_type='parent',
            is_active=True,
        ).select_related('profile').order_by('first_name', 'username')
        data = [
            {
                'id': u.id,
                'username': u.username,
                'first_name': u.first_name,
                'last_name': u.last_name,
            }
            for u in parents
        ]
        return Response(data)


# ==========================================
# 💰 THE PAYROLL ENGINE
# ==========================================
class PayrollViewSet(viewsets.ViewSet):
    """
    Calculates salaries dynamically based on TeacherProfile rates
    and the number of 'Joined' students assigned to them.
    PERFORMANCE FIX: Eradicated O(N) N+1 query loops.
    """
    permission_classes = [IsAuthenticated, IsOwner]

    def list(self, request):
        from students.models import Student

        # 1. Fetch all teachers in one query
        teachers = User.objects.filter(
            profile__user_type='teacher'
        ).select_related('profile', 'profile__teacher_data')

        # 2. FAST AGGREGATION: Execute a single query to get all active student counts grouped by teacher
        # This prevents the database from being hammered in a loop.
        student_counts_query = Student.objects.filter(
            status='Joined'
        ).values('assigned_teacher').annotate(count=Count('id'))
        
        # Build an O(1) lookup dictionary in memory
        student_counts_map = {
            item['assigned_teacher'].lower(): item['count'] 
            for item in student_counts_query 
            if item['assigned_teacher']
        }

        payroll_data = []
        for teacher in teachers:
            # O(1) memory retrieval instead of a database hit
            student_count = student_counts_map.get(teacher.username.lower(), 0)

            try:
                t_data = teacher.profile.teacher_data
                # PRECISION FIX (A-P2-03): Django returns Decimal objects from
                # DecimalField. Using float() here converts to binary IEEE 754,
                # introducing rounding errors (e.g. 123.45 → 123.45000000000001).
                # Keep as Decimal throughout; str() at serialisation preserves
                # exact digits. int * Decimal = Decimal in Python, so the
                # student_count multiplication is safe without casting.
                base = t_data.base_salary
                per_student = t_data.salary_per_student
            except (Profile.DoesNotExist, TeacherProfile.DoesNotExist, AttributeError):
                base = Decimal('0')          # NOT 0.0 — float literal would reintroduce imprecision
                per_student = Decimal('0')

            total_pay = base + (student_count * per_student)  # Decimal + Decimal = Decimal

            payroll_data.append({
                'id': teacher.id,
                'name': f"{teacher.first_name} {teacher.last_name}" if teacher.first_name else teacher.username,
                'username': teacher.username,
                'active_students': student_count,
                'base_salary': str(base),          # str(Decimal) preserves exact precision
                'per_student_rate': str(per_student),
                'total_calculated': str(total_pay),
                'status': 'Pending'
            })

        return Response(payroll_data)


# ==========================================
# 👨‍🏫 TEACHER MANAGEMENT
# ==========================================
class TeacherViewSet(viewsets.ModelViewSet):
    """
    SECURED: Read access for all authenticated staff/teachers.
    Write access (create, update, delete) restricted to owner/head_manager/manager.
    """
    queryset = User.objects.filter(
        profile__user_type='teacher'
    ).select_related('profile', 'profile__teacher_data')
    serializer_class = TeacherListSerializer

    # Admin roles that may see financial data (salary, bank details).
    # Any role not in this set receives TeacherPublicSerializer instead.
    _ADMIN_ROLES = {'owner', 'head_manager', 'manager'}

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsOwnerOrManager()]

    def get_serializer_class(self):
        """
        SECURITY FIX (A-P8-03): Gate financial teacher data behind admin roles.

        TeacherListSerializer includes bank_details, base_salary, salary_per_student,
        hourly_rate, and is_verified — data no student or parent should ever see.
        Admin roles (owner / head_manager / manager) receive the full serializer.
        Everyone else receives TeacherPublicSerializer: id, username, name, bio,
        and class schedule only.
        """
        try:
            role = self.request.user.profile.user_type
        except (AttributeError, Profile.DoesNotExist):
            # No profile → treat as lowest privilege
            return TeacherPublicSerializer
        if role in self._ADMIN_ROLES:
            return TeacherListSerializer
        return TeacherPublicSerializer

    def get_serializer_context(self):
        """
        PERFORMANCE FIX (A-P2-02 / A-P6-03): Inject a pre-built student map
        into serializer context so get_classes() never queries per-teacher.

        Without this, TeacherListSerializer.get_classes() fires one
        Student.objects.filter() query per teacher row (N+1). With this
        override, a single bulk query builds a username-keyed dict and
        get_classes() reads from it in O(1) — total cost: 1 query for the
        entire teacher list regardless of T.
        """
        context = super().get_serializer_context()
        if self.action in ('list', 'retrieve'):
            from students.models import Student
            # One bulk query for all active students across all teachers
            active_students = Student.objects.filter(
                status='Joined'
            ).values('assigned_teacher', 'full_name', 'class_timing', 'guardian_name')

            # Build username (case-folded) -> [student_dict, ...] map
            student_map = {}
            for s in active_students:
                key = (s['assigned_teacher'] or '').lower()
                student_map.setdefault(key, []).append({
                    'student_name': s['full_name'],
                    'timing': s['class_timing'],
                    'guardian': s['guardian_name'],
                })
            context['student_map'] = student_map
        return context


# ==========================================
# 👑 GOD-MODE: ACCESS CONTROL VIEW
# ==========================================
class SystemAccessViewSet(viewsets.ViewSet):
    """
    A-P4-01 FIX: list() now paginates. Previously returned ALL user PIIs in a
    single un-bounded response. Now enforces page_size=50 (max 200) with the
    standard DRF {count, next, previous, results} envelope.

    partial_update (PATCH /:id/) acts on a single user — unchanged.
    """
    permission_classes = [IsAuthenticated, IsOwner]

    def list(self, request):
        users = User.objects.exclude(id=request.user.id).select_related('profile').order_by('username')
        data = []
        for user in users:
            try:
                role = user.profile.user_type
            except (Profile.DoesNotExist, AttributeError):
                role = 'student'
            data.append({
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'is_active': user.is_active,
                'role': role,
                'first_name': user.first_name,
                'last_name': user.last_name
            })

        # A-P4-01: Manual pagination — ViewSet list() does not auto-paginate;
        # must instantiate the paginator and call paginate_queryset() explicitly.
        # Mirrors the same pattern used in PaymentListView (A-P1-08).
        paginator = PageNumberPagination()
        paginator.page_size = 50
        paginator.max_page_size = 200
        paginator.page_size_query_param = 'page_size'
        page = paginator.paginate_queryset(data, request)
        if page is not None:
            return paginator.get_paginated_response(page)
        return Response(data)

    @transaction.atomic
    def partial_update(self, request, pk=None):
        try:
            user = User.objects.select_for_update().get(pk=pk)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        proposed_active = user.is_active
        if 'is_active' in request.data:
            val = request.data['is_active']
            if isinstance(val, str):
                proposed_active = val.lower() not in ['false', '0', '']
            else:
                proposed_active = bool(val)

        proposed_role = user.profile.user_type if hasattr(user, 'profile') else 'student'
        if 'role' in request.data:
            proposed_role = request.data['role']

        is_self = (user.id == request.user.id)

        if is_self:
            if not proposed_active:
                return Response({'error': 'You cannot deactivate your own account'}, status=status.HTTP_400_BAD_REQUEST)
            if proposed_role != 'owner':
                return Response({'error': 'You cannot demote your own account'}, status=status.HTTP_400_BAD_REQUEST)

        # Check if target is currently an active owner
        target_is_active_owner = user.is_active and hasattr(user, 'profile') and user.profile.user_type == 'owner'

        # Ensure we don't leave 0 active owners
        if target_is_active_owner and (not proposed_active or proposed_role != 'owner'):
            other_active_owners = Profile.objects.filter(
                user_type='owner', 
                user__is_active=True
            ).exclude(user_id=user.id).count()
            if other_active_owners == 0:
                return Response({'error': 'Cannot remove the last active owner.'}, status=status.HTTP_400_BAD_REQUEST)

        if 'is_active' in request.data:
            user.is_active = proposed_active
            user.save(update_fields=['is_active'])

        if 'role' in request.data:
            valid_roles = [choice[0] for choice in Profile.USER_TYPES]
            if proposed_role not in valid_roles:
                return Response(
                    {'error': f'Invalid role. Must be one of: {valid_roles}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            profile, created = Profile.objects.get_or_create(user=user)
            profile.user_type = proposed_role
            profile.save(update_fields=['user_type'])

        return Response({'status': 'Access updated successfully'})


# ===========================================================================
# 🔒 LOGOUT — Server-side token invalidation via blacklist
# ===========================================================================
class LogoutView(APIView):
    """
    POST /api/accounts/logout/
    Body: { "refresh": "<refresh_token>" }

    Blacklists the supplied refresh token so it cannot be used to obtain new
    access tokens. Requires authentication so anonymous callers cannot probe
    the blacklist. Returns 205 Reset Content on success (signals the client to
    clear its stored credentials).

    The token_blacklist app (INSTALLED_APPS) maintains OutstandingToken and
    BlacklistedToken tables. ROTATE_REFRESH_TOKENS + BLACKLIST_AFTER_ROTATION
    in SIMPLE_JWT settings ensure every refresh call also rotates and blacklists.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response(
                {'error': 'Refresh token is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except (TokenError, InvalidToken) as e:
            return Response(
                {'error': 'Token is invalid or already blacklisted.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        return Response(status=status.HTTP_205_RESET_CONTENT)