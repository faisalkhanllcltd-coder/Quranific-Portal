from rest_framework import viewsets, filters, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.utils import timezone
from django.db import transaction
from django.contrib.auth.models import User
from accounts.models import Profile
from accounts.views import IsOwnerOrManager, IsOwnerOrHeadManager, IsStaffOrTeacher
from .models import Student, Attendance, Assignment, Submission, StudyMaterial
from .serializers import (
    StudentSerializer, AttendanceSerializer,
    AssignmentSerializer, SubmissionSerializer, StudyMaterialSerializer
)


# ==========================================
# 🛡️ THE RECOVERY VAULT: ViewSet Mixin
# ==========================================
class RecoveryVaultMixin:
    """
    A reusable mixin that adds Soft Delete capabilities to any ViewSet.
    Provides endpoints to view the vault and restore deleted records.
    """
    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated, IsOwnerOrManager])
    def vault(self, request):
        """GET /api/<model>/vault/ - Returns ONLY soft-deleted records."""
        # Note: We must use .all_objects instead of .objects to see deleted items.
        deleted_records = self.queryset.model.all_objects.filter(is_deleted=True).order_by('-deleted_at')
        
        page = self.paginate_queryset(deleted_records)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(deleted_records, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsOwnerOrManager])
    def restore(self, request, pk=None):
        """POST /api/<model>/<id>/restore/ - Recovers a soft-deleted record."""
        try:
            # Must query against all_objects, otherwise the 404 will trigger for deleted items
            record = self.queryset.model.all_objects.get(pk=pk, is_deleted=True)
            record.restore()
            return Response({"message": f"{record} restored successfully."}, status=status.HTTP_200_OK)
        except self.queryset.model.DoesNotExist:
            return Response({"error": "Record not found in the vault."}, status=status.HTTP_404_NOT_FOUND)


# ==========================================
# 1. CORE STUDENT ENGINE (Multi-Tenant Hub)
# ==========================================
class StudentViewSet(RecoveryVaultMixin, viewsets.ModelViewSet):
    """
    SECURED:
    - Admin: Full Access.
    - Teacher: Sees only their assigned students.
    - Parent: Sees only their linked children.
    """
    serializer_class = StudentSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['full_name', 'email', 'guardian_name', 'whatsapp', 'assigned_teacher']
    ordering_fields = ['full_name', 'status', 'created_at']

    def get_serializer_class(self):
        user = self.request.user
        if hasattr(user, 'profile') and getattr(user.profile, 'user_type', None) in ['owner', 'head_manager']:
            return StudentSerializer
        from .serializers import StudentManagerSerializer
        return StudentManagerSerializer

    def get_permissions(self):
        # A-P8-02 — THREE-TIER CAPABILITY SPLIT:
        #   Tier 1  (read)        → any authenticated user (parents/teachers load their own students)
        #   Tier 2  (destructive) → owner + head_manager only (delete, credential reset)
        #   Tier 3  (write)       → owner + head_manager + manager (create, update)
        if self.action in ('list', 'retrieve'):
            return [permissions.IsAuthenticated()]
        if self.action in ('destroy', 'update_credentials'):
            return [permissions.IsAuthenticated(), IsOwnerOrHeadManager()]
        return [permissions.IsAuthenticated(), IsOwnerOrManager()]

    def get_queryset(self):
        user = self.request.user
        # ── PERFORMANCE FIX (A-P2-01 / A-P6-01) ──────────────────────────────
        # Without eager loading, StudentSerializer fires 3N+2 SQL queries for N
        # students:  user FK (N), parent_account FK (N), attendance (N),
        # assignments (N), and assignments→submissions (N). With the additions
        # below, the entire list page collapses to 6 queries regardless of N.
        #
        #   select_related  → JOIN: resolves ForeignKey / OneToOne in one query
        #   prefetch_related → bulk IN (...): resolves reverse FKs in one query each
        queryset = (
            Student.objects
            .select_related('user', 'parent_account')
            .prefetch_related(
                'student_daily_attendance',   # Attendance.related_name
                'assignments__submissions',   # Assignment then nested Submission
                'study_materials',            # StudyMaterial.related_name
            )
            .order_by('-created_at')
        )
        try:
            role = user.profile.user_type
            if role == 'teacher':
                return queryset.filter(assigned_teacher__iexact=user.username)
            elif role == 'parent':
                # PHASE 2: The Multi-Tenant Intercept
                return queryset.filter(parent_account=user)
            elif role == 'student':
                # Just in case a student hits this endpoint
                return queryset.filter(user=user)
        except Profile.DoesNotExist:
            return queryset.none()
        return queryset

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """
        Overrides default create to grab manual username/password from the frontend.
        Phase 2: Also accepts 'parent_account_id' to link the child.
        """
        username = request.data.get('username')
        password = request.data.get('password')
        parent_id = request.data.get('parent_account_id')

        if not username or not password:
            return Response(
                {"error": "Username and password are required to create the student portal account."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        if User.objects.filter(username=username).exists():
            return Response(
                {"error": "This username is already taken. Please choose another."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate parent if provided, before creating anything
        parent_user = None
        if parent_id:
            try:
                parent_user = User.objects.get(id=parent_id, profile__user_type='parent')
            except User.DoesNotExist:
                return Response(
                    {"error": f"Invalid parent_account_id '{parent_id}'. No such parent account exists."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        student = serializer.save()

        # Link parent if provided
        if parent_user:
            student.parent_account = parent_user

        user = User.objects.create_user(
            username=username,
            password=password,
            first_name=student.full_name.split()[0] if student.full_name else "",
            last_name=" ".join(student.full_name.split()[1:]) if student.full_name else "",
            email=student.email or ""
        )

        student.user = user
        student.save(update_fields=['user', 'parent_account'])

        profile, created = Profile.objects.get_or_create(user=user)
        profile.user_type = 'student'
        profile.whatsapp_number = student.whatsapp or ""
        profile.save(update_fields=['user_type', 'whatsapp_number'])

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    # A-P8-02: IsOwnerOrHeadManager — plain manager cannot reset student login credentials.
    # (get_permissions() also gates this, but the decorator is kept for explicit clarity on the action.)
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsOwnerOrHeadManager])
    def update_credentials(self, request, pk=None):
        student = self.get_object()
        user = student.user

        if not user:
            return Response({"error": "No login account is attached to this student."}, status=status.HTTP_400_BAD_REQUEST)

        new_username = request.data.get('username')
        new_password = request.data.get('password')

        if new_username and new_username != user.username:
            if User.objects.filter(username=new_username).exists():
                return Response({"error": "That username is already taken by someone else."}, status=status.HTTP_400_BAD_REQUEST)
            user.username = new_username
        
        if new_password:
            user.set_password(new_password)

        user.save()
        return Response({"message": "Credentials updated successfully!"}, status=status.HTTP_200_OK)


# ==========================================
# 2. ATTENDANCE ENGINE
# ==========================================
class AttendanceViewSet(viewsets.ModelViewSet):
    serializer_class = AttendanceSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['student__full_name', 'status', 'marked_by']
    ordering_fields = ['date', 'status']

    def get_permissions(self):
        # Parents and students need read access
        if self.action in ('list', 'retrieve'):
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), IsStaffOrTeacher()]

    def get_queryset(self):
        user = self.request.user
        queryset = Attendance.objects.all().select_related('student').order_by('-date')
        try:
            role = user.profile.user_type
            if role == 'teacher':
                return queryset.filter(student__assigned_teacher__iexact=user.username)
            elif role == 'parent':
                # PHASE 2: Intercept
                return queryset.filter(student__parent_account=user)
            elif role == 'student':
                return queryset.filter(student__user=user)
        except Profile.DoesNotExist:
            return queryset.none()
        return queryset

    @action(
        detail=False,
        methods=['post'],
        # SECURITY FIX (A-P1-07): Explicit permission on @action decorator.
        # Without this kwarg, protection relied silently on the else-branch of
        # get_permissions() — any future edit there could accidentally drop the
        # guard. IsStaffOrTeacher blocks parent/student roles explicitly.
        permission_classes=[permissions.IsAuthenticated, IsStaffOrTeacher],
    )
    def bulk_mark(self, request):
        attendance_data = request.data
        if not isinstance(attendance_data, list):
            return Response({"error": "Expected a list."}, status=status.HTTP_400_BAD_REQUEST)

        marked_by = request.user.username
        results, errors = [], []
        valid_statuses = [choice[0] for choice in Attendance.STATUS_CHOICES]

        for item in attendance_data:
            student_id = item.get('student')
            record_date = item.get('date', timezone.now().date())
            att_status = item.get('status', 'Present')

            if att_status not in valid_statuses:
                errors.append({'student': student_id, 'error': f"Invalid status '{att_status}'"})
                continue

            # PARTIAL-FAILURE FIX (A-P2-05): Use a savepoint per item.
            # The previous @transaction.atomic on the outer method was dangerous:
            # one unexpected DB error (constraint, deadlock) would abort the whole
            # transaction but the loop kept running, causing TransactionManagementError
            # on every subsequent query and silently rolling back all prior writes.
            # With savepoints, each item is isolated — a failure rolls back only that
            # item and is reported in errors[]; all other items complete normally.
            try:
                with transaction.atomic():  # creates a savepoint inside any outer transaction
                    student = Student.objects.get(id=student_id)
                    record, created = Attendance.objects.update_or_create(
                        student=student, date=record_date,
                        defaults={'status': att_status, 'marked_by': marked_by}
                    )
                    results.append(AttendanceSerializer(record).data)
            except Student.DoesNotExist:
                errors.append({'student': student_id, 'error': "Student not found."})
            except Exception as exc:
                # Catch unexpected DB errors (constraints, deadlocks, etc.) per-item
                # so they are reported but do not abort the remaining batch.
                errors.append({'student': student_id, 'error': f"Unexpected error: {exc}"})

        return Response({"message": f"Marked {len(results)}.", "data": results, "errors": errors})



# ==========================================
# 3. LMS ENGINE: Assignments & Submissions
# ==========================================
class AssignmentViewSet(RecoveryVaultMixin, viewsets.ModelViewSet):
    serializer_class = AssignmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = Assignment.objects.all().select_related('student', 'created_by').prefetch_related('submissions').order_by('-created_at')
        try:
            role = user.profile.user_type
            if role == 'teacher':
                return queryset.filter(student__assigned_teacher__iexact=user.username)
            elif role == 'parent':
                # PHASE 2: Intercept
                return queryset.filter(student__parent_account=user)
            elif role == 'student':
                return queryset.filter(student__user=user)
        except Profile.DoesNotExist:
            return queryset.none()
        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class SubmissionViewSet(viewsets.ModelViewSet):
    serializer_class = SubmissionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = Submission.objects.all().select_related('student', 'assignment').order_by('-submitted_at')
        try:
            role = user.profile.user_type
            if role == 'teacher':
                return queryset.filter(student__assigned_teacher__iexact=user.username)
            elif role == 'parent':
                # PHASE 2: Intercept
                return queryset.filter(student__parent_account=user)
            elif role == 'student':
                return queryset.filter(student__user=user)
        except Profile.DoesNotExist:
            return queryset.none()
        return queryset

    def perform_update(self, serializer):
        if 'grade' in serializer.validated_data and not serializer.instance.graded_at:
            serializer.save(graded_at=timezone.now())
        else:
            serializer.save()


class StudyMaterialViewSet(RecoveryVaultMixin, viewsets.ModelViewSet):
    serializer_class = StudyMaterialSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = StudyMaterial.objects.all().select_related('student', 'uploaded_by').order_by('-created_at')
        try:
            role = user.profile.user_type
            if role == 'teacher':
                return queryset.filter(student__assigned_teacher__iexact=user.username)
            elif role == 'parent':
                # PHASE 2: Intercept
                return queryset.filter(student__parent_account=user)
            elif role == 'student':
                return queryset.filter(student__user=user)
        except Profile.DoesNotExist:
            return queryset.none()
        return queryset

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)