from django.db.models.signals import post_save
from django.dispatch import receiver
from students.models import Student, Attendance # <--- FIX: Imported Attendance from the new master app
from .models import SystemLog

@receiver(post_save, sender=Student)
def log_student_save(sender, instance, created, **kwargs):
    action = "Enrollment" if created else "Profile Update"
    SystemLog.objects.create(
        action=action,
        details=f"Student: {instance.full_name} (ID: #{instance.id}) was {action.lower()}d."
    )

@receiver(post_save, sender=Attendance)
def log_attendance_save(sender, instance, created, **kwargs):
    SystemLog.objects.create(
        action="Attendance Marked",
        details=f"Student {instance.student.full_name} marked as {instance.status} for {instance.date}."
    )