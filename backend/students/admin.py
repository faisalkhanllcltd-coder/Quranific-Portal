from django.contrib import admin
from .models import Student


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ('id', 'full_name', 'age', 'status', 'assigned_teacher', 'guardian_name')
    search_fields = ('full_name', 'email', 'guardian_name', 'whatsapp')
    list_filter = ('status', 'gender', 'class_timing')