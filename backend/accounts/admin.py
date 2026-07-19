from django.contrib import admin
from .models import Profile, TeacherProfile

@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'user_type', 'whatsapp_number')
    list_filter = ('user_type',)
    search_fields = ('user__username', 'whatsapp_number')

@admin.register(TeacherProfile)
class TeacherProfileAdmin(admin.ModelAdmin):
    list_display = ('profile', 'hourly_rate', 'is_verified')
    list_filter = ('is_verified',)
    search_fields = ('profile__user__username',)