from django.db import models
from django.utils import timezone
from django.conf import settings
from django.core.validators import RegexValidator

phone_validator = RegexValidator(
    regex=r'^\+[1-9]\d{1,14}$',
    message="Phone number must be entered in the format: '+999999999'. Up to 15 digits allowed."
)

# ==========================================
# 🛡️ THE RECOVERY VAULT: Soft Delete Engine
# ==========================================
class SoftDeleteManager(models.Manager):
    """
    Standard Query Manager: Automatically filters out any records 
    that have been sent to the Recovery Vault. 
    (Keeps the main app clean with zero extra code in views).
    """
    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)

class SoftDeleteModel(models.Model):
    """
    Enterprise Base Class: Intercepts the .delete() command.
    Instead of dropping the row, it flags it and timestamps it.
    """
    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = SoftDeleteManager()  # Default: Sees only active records
    all_objects = models.Manager() # God-Mode: Sees active + deleted (For the Vault View)

    class Meta:
        abstract = True

    def delete(self, *args, **kwargs):
        """Intercepts hard deletes and sends the record to the vault."""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save(update_fields=['is_deleted', 'deleted_at'])

    def hard_delete(self, *args, **kwargs):
        """Bypass for when you actually need to nuke the row permanently."""
        super().delete(*args, **kwargs)

    def restore(self):
        """Pulls the record out of the vault and back into the live app."""
        self.is_deleted = False
        self.deleted_at = None
        self.save(update_fields=['is_deleted', 'deleted_at'])


# ==========================================
# 🎓 STUDENT CORE
# ==========================================
class Student(SoftDeleteModel):
    # --- Link to Django Auth (The Student's Own Login) ---
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='student_record',
        help_text="The login account associated with this student."
    )

    # --- PHASE 1: The Parent/Guardian Master Link ---
    parent_account = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='children',
        help_text="The master parent account managing this student."
    )

    # --- Student Details ---
    full_name = models.CharField(max_length=200)
    gender = models.CharField(max_length=10, choices=[('Male', 'Male'), ('Female', 'Female')], default='Male')
    age = models.IntegerField()
    email = models.EmailField(blank=True, null=True)
    whatsapp = models.CharField(max_length=20, blank=True, null=True, validators=[phone_validator])
    
    # --- Class Info ---
    class_timing = models.CharField(max_length=100, blank=True, null=True, help_text="e.g. 5:00 PM - 6:00 PM")
    assigned_teacher = models.CharField(max_length=200, blank=True, null=True)
    status = models.CharField(max_length=20, choices=[
        ('Trial', 'Trial'),
        ('Joined', 'Joined'),
        ('Left', 'Left')
    ], default='Trial')

    # --- Guardian Details ---
    guardian_name = models.CharField(max_length=200)
    guardian_relation = models.CharField(max_length=50, choices=[
        ('Parent', 'Parent'),
        ('Brother', 'Brother'),
        ('Sister', 'Sister'),
        ('Friend', 'Friend'),
        ('Other', 'Other')
    ], default='Parent')
    country = models.CharField(max_length=100, blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    guardian_email = models.EmailField(blank=True, null=True)
    guardian_whatsapp = models.CharField(max_length=20, validators=[phone_validator])

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.full_name


# ==========================================
# 📅 ATTENDANCE ENGINE
# ==========================================
class Attendance(SoftDeleteModel):
    STATUS_CHOICES = (
        ('Present', 'Present'),
        ('Absent', 'Absent'),
        ('Late', 'Late'),
        ('Leave', 'Leave')
    )
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='student_daily_attendance')
    date = models.DateField(default=timezone.now)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='Present')
    marked_by = models.CharField(max_length=100, blank=True, help_text="Username of the teacher who marked it")

    class Meta:
        unique_together = ('student', 'date') 

    def __str__(self):
        return f"{self.student.full_name} - {self.date} - {self.status}"


# ==========================================
# 📚 LMS ENGINE: ASSIGNMENTS & MATERIALS
# ==========================================
class Assignment(SoftDeleteModel):
    title = models.CharField(max_length=255)
    description = models.TextField()
    
    # Enforces Data Isolation: An assignment is tied to a specific student
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='assignments')
    
    # The teacher who gave it
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        related_name='created_assignments'
    )
    
    due_date = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Assignment: {self.title} for {self.student.full_name}"


class Submission(SoftDeleteModel):
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name='submissions')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='submissions')
    
    content_text = models.TextField(blank=True, help_text="Text answer provided by student")
    content_link = models.URLField(blank=True, help_text="Link to external work (e.g. Google Drive, YouTube)")
    
    grade = models.CharField(max_length=50, blank=True)
    feedback = models.TextField(blank=True)
    
    submitted_at = models.DateTimeField(auto_now_add=True)
    graded_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Submission by {self.student.full_name} for {self.assignment.title}"


class StudyMaterial(SoftDeleteModel):
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    link = models.URLField(help_text="Link to the PDF / Resource")
    
    # Enforces Data Isolation: The material is shared with a specific student
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='study_materials')
    
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True,
        related_name='uploaded_materials'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} for {self.student.full_name}"