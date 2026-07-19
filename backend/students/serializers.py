from rest_framework import serializers
from .models import Student, Attendance, Assignment, Submission, StudyMaterial

# 1. LMS: Submission Serializer
class SubmissionSerializer(serializers.ModelSerializer):
    student_name = serializers.ReadOnlyField(source='student.full_name')

    class Meta:
        model = Submission
        fields = [
            'id', 'assignment', 'student', 'student_name', 
            'content_text', 'content_link', 'grade', 'feedback', 
            'submitted_at', 'graded_at'
        ]
        read_only_fields = ['id', 'student_name', 'submitted_at', 'graded_at']


# 2. LMS: Assignment Serializer
class AssignmentSerializer(serializers.ModelSerializer):
    student_name = serializers.ReadOnlyField(source='student.full_name')
    creator_name = serializers.ReadOnlyField(source='created_by.username')
    submissions = SubmissionSerializer(many=True, read_only=True)

    class Meta:
        model = Assignment
        fields = [
            'id', 'student', 'student_name', 'title', 'description', 
            'created_by', 'creator_name', 'due_date', 'created_at', 'submissions'
        ]
        read_only_fields = ['id', 'student_name', 'created_by', 'creator_name', 'created_at', 'submissions']


# 3. LMS: Study Material Serializer
class StudyMaterialSerializer(serializers.ModelSerializer):
    student_name = serializers.ReadOnlyField(source='student.full_name')
    uploader_name = serializers.ReadOnlyField(source='uploaded_by.username')

    class Meta:
        model = StudyMaterial
        fields = [
            'id', 'student', 'student_name', 'title', 'description', 
            'link', 'uploaded_by', 'uploader_name', 'created_at'
        ]
        read_only_fields = ['id', 'student_name', 'uploaded_by', 'uploader_name', 'created_at']


# 4. Attendance Serializer
class AttendanceSerializer(serializers.ModelSerializer):
    student_name = serializers.ReadOnlyField(source='student.full_name')

    class Meta:
        model = Attendance
        fields = [
            'id', 'student', 'student_name', 'date', 'status', 'marked_by'
        ]
        read_only_fields = ['id', 'student_name']


# 5. Student Serializer (Phase 2 Upgrades)
class StudentSerializer(serializers.ModelSerializer):
    attendance_history = AttendanceSerializer(many=True, read_only=True, source='student_daily_attendance')
    assignments = AssignmentSerializer(many=True, read_only=True)
    study_materials = StudyMaterialSerializer(many=True, read_only=True)

    # Expose the username strings for easy frontend mapping
    auth_username = serializers.ReadOnlyField(source='user.username')
    parent_username = serializers.ReadOnlyField(source='parent_account.username')

    class Meta:
        model = Student
        fields = [
            'id', 'user', 'auth_username', 'parent_account', 'parent_username', 
            'full_name', 'gender', 'age', 'email', 'whatsapp',
            'class_timing', 'assigned_teacher', 'status',
            'guardian_name', 'guardian_relation', 'country', 'city',
            'guardian_email', 'guardian_whatsapp', 'created_at',
            'attendance_history', 'assignments', 'study_materials'
        ]
        read_only_fields = [
            'id', 'created_at', 'attendance_history', 
            'assignments', 'study_materials', 'auth_username', 'parent_username'
        ]


# 6. Student Manager Serializer (A-P1-09 FIX)
class StudentManagerSerializer(StudentSerializer):
    """
    A-P1-09 FIX: Manager-scoped serializer.
    Prevents managers from making academic or structural reassignments.
    They can only update biographical and contact information.
    """
    class Meta(StudentSerializer.Meta):
        read_only_fields = StudentSerializer.Meta.read_only_fields + [
            'user', 'parent_account', 'assigned_teacher', 'status', 'class_timing'
        ]

    def validate(self, attrs):
        disallowed_fields = {'user', 'parent_account', 'assigned_teacher', 'status', 'class_timing'}
        provided_fields = set(self.initial_data.keys())
        invalid_fields = provided_fields.intersection(disallowed_fields)

        if invalid_fields:
            raise serializers.ValidationError(
                {"error": f"Managers cannot modify the following fields: {', '.join(sorted(invalid_fields))}"}
            )
        return super().validate(attrs)