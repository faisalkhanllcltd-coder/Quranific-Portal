from django.db import transaction
from rest_framework import serializers
from django.contrib.auth.models import User
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import Profile, TeacherProfile


# 1. Basic User Serializer
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email']


# 2. Profile Serializer
class ProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = Profile
        fields = ['id', 'user', 'user_type', 'bio', 'whatsapp_number']


# 3. Teacher Profile (Upgraded for Financials)
class TeacherProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = TeacherProfile
        fields = ['base_salary', 'salary_per_student', 'hourly_rate', 'bank_details', 'is_verified']


# 4. THE "RICH" TEACHER SERIALIZER (Merged with Payroll Logic)
class TeacherListSerializer(serializers.ModelSerializer):
    whatsapp = serializers.CharField(source='profile.whatsapp_number', read_only=True)
    bio = serializers.CharField(source='profile.bio', read_only=True)
    classes = serializers.SerializerMethodField()

    # Nested financial data connection
    teacher_data = TeacherProfileSerializer(source='profile.teacher_data', read_only=False, required=False)

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'is_active', 'whatsapp', 'bio', 'classes', 'teacher_data']

    def get_classes(self, obj):
        # ── PERFORMANCE FIX (A-P2-02 / A-P6-03) ──────────────────────────────
        # TeacherViewSet.get_serializer_context() pre-builds a username-keyed
        # dict of active students in one bulk query and injects it here.
        # Reading from that dict is O(1) per teacher — no DB hit.
        #
        # Fallback to a direct query when context key is absent (e.g. tests,
        # admin, or management commands that instantiate this serializer
        # directly without going through TeacherViewSet).
        student_map = self.context.get('student_map')
        if student_map is not None:
            return student_map.get(obj.username.lower(), [])

        # Fallback: single-teacher query (safe but un-cached)
        from students.models import Student
        students = Student.objects.filter(assigned_teacher__iexact=obj.username, status='Joined')
        return [
            {
                "student_name": s.full_name,
                "timing": s.class_timing,
                "guardian": s.guardian_name
            }
            for s in students
        ]

    @transaction.atomic
    def update(self, instance, validated_data):
        """
        HARDENED: Wrapped in transaction.atomic() to prevent partial data
        corruption if the TeacherProfile save fails after the User save.
        """
        # Extract the nested financial payload sent from React
        profile_data = validated_data.pop('profile', {})
        teacher_data = profile_data.get('teacher_data', {})

        # Update standard User info
        instance.first_name = validated_data.get('first_name', instance.first_name)
        instance.last_name = validated_data.get('last_name', instance.last_name)
        instance.email = validated_data.get('email', instance.email)
        instance.is_active = validated_data.get('is_active', instance.is_active)
        instance.save(update_fields=['first_name', 'last_name', 'email', 'is_active'])

        # Update the Financials
        if teacher_data:
            t_profile, created = TeacherProfile.objects.get_or_create(profile=instance.profile)
            t_profile.base_salary = teacher_data.get('base_salary', t_profile.base_salary)
            t_profile.salary_per_student = teacher_data.get('salary_per_student', t_profile.salary_per_student)
            t_profile.save(update_fields=['base_salary', 'salary_per_student'])

        return instance


# 5. SECURE PUBLIC TEACHER SERIALIZER (A-P8-03)
# Read-only, finance-free view served to non-admin roles (teacher / parent / student).
# Exposes only the fields needed for operational visibility (name, bio, schedule).
# NEVER expose: email, is_active, whatsapp, bank_details, base_salary,
#               salary_per_student, hourly_rate, is_verified.
class TeacherPublicSerializer(serializers.ModelSerializer):
    bio = serializers.CharField(source='profile.bio', read_only=True)
    classes = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'bio', 'classes']

    def get_classes(self, obj):
        # Re-uses the same student_map injection from TeacherViewSet.get_serializer_context()
        student_map = self.context.get('student_map')
        if student_map is not None:
            return student_map.get(obj.username.lower(), [])
        # Fallback for non-viewset callers
        from students.models import Student
        students = Student.objects.filter(assigned_teacher__iexact=obj.username, status='Joined')
        return [
            {"student_name": s.full_name, "timing": s.class_timing, "guardian": s.guardian_name}
            for s in students
        ]



class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        try:
            data['user_type'] = self.user.profile.user_type
            data['username'] = self.user.username
        except Profile.DoesNotExist:
            data['user_type'] = 'student'
            data['username'] = self.user.username
        return data


# --- THE SECURE REGISTRATION SERIALIZER ---
class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    whatsapp = serializers.CharField(write_only=True, required=False, allow_blank=True)
    bio = serializers.CharField(write_only=True, required=False, allow_blank=True)
    user_type = serializers.CharField(write_only=True, default='teacher')
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)

    # Explicit list of valid user_type values to prevent privilege escalation
    VALID_USER_TYPES = [choice[0] for choice in Profile.USER_TYPES]

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'whatsapp', 'bio', 'user_type', 'first_name', 'last_name']

    def validate_user_type(self, value):
        """
        HARDENED: Reject any user_type that is not in the Profile.USER_TYPES choices.
        This prevents privilege escalation via crafted API requests.
        """
        if value not in self.VALID_USER_TYPES:
            raise serializers.ValidationError(
                f"Invalid user_type '{value}'. Must be one of: {self.VALID_USER_TYPES}"
            )
        return value

    @transaction.atomic
    def create(self, validated_data):
        """
        HARDENED: Wrapped in transaction.atomic() so that if Profile or
        TeacherProfile creation fails, the User creation is rolled back.
        """
        whatsapp = validated_data.pop('whatsapp', '')
        bio = validated_data.pop('bio', '')
        user_type = validated_data.pop('user_type', 'teacher')
        first_name = validated_data.pop('first_name', '')
        last_name = validated_data.pop('last_name', '')

        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
            first_name=first_name,
            last_name=last_name,
        )

        Profile.objects.update_or_create(
            user=user,
            defaults={
                'user_type': user_type,
                'whatsapp_number': whatsapp,
                'bio': bio
            }
        )

        if user_type == 'teacher':
            TeacherProfile.objects.get_or_create(profile=user.profile)

        return user