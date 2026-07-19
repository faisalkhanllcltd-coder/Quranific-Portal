import logging

from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


class Profile(models.Model):
    USER_TYPES = (
        ('owner', 'Owner (Super Admin)'),        # Portal 1
        ('head_manager', 'Head Manager'),        # Portal 2
        ('manager', 'Manager'),                  # Portal 3
        ('teacher', 'Teacher (Ustad)'),          # Portal 4
        ('student', 'Student (Talib)'),          # Portal 5
        ('parent', 'Parent/Guardian'),           # Portal 6 (Phase 1: Parent Identity Added)
    )

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    user_type = models.CharField(max_length=20, choices=USER_TYPES, default='student')
    whatsapp_number = models.CharField(max_length=20, blank=True)
    bio = models.TextField(blank=True)

    def __str__(self):
        return f"{self.user.username} - {self.get_user_type_display()}"


class TeacherProfile(models.Model):
    profile = models.OneToOneField(Profile, on_delete=models.CASCADE, related_name='teacher_data')
    is_verified = models.BooleanField(default=False)

    # --- PAYROLL ENGINE FIELDS ---
    base_salary = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text="Fixed monthly pay")
    salary_per_student = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text="Bonus pay per active student")
    hourly_rate = models.DecimalField(max_digits=6, decimal_places=2, default=0.00, help_text="Pay per hour (if applicable)")

    joining_date = models.DateField(null=True, blank=True)
    bank_details = models.TextField(blank=True, help_text="IBAN, Bank Name, or EasyPaisa/PayPal info")

    def __str__(self):
        return f"Ustad: {self.profile.user.username}"


# --- AUTO-CREATE SIGNALS ---

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """Create a Profile automatically when a new User is created."""
    if created:
        Profile.objects.create(user=instance)


@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    """
    Save the associated Profile when a User is saved.
    Guarded against Profile.DoesNotExist to prevent crashes when
    the profile has been deleted or not yet created.
    """
    try:
        instance.profile.save()

        # If the user is a teacher, ensure they have a TeacherProfile too
        if instance.profile.user_type == 'teacher':
            TeacherProfile.objects.get_or_create(profile=instance.profile)
    except Profile.DoesNotExist:
        logger.warning("Profile missing for user %s (id=%s) — skipping save.", instance.username, instance.pk)