import pytest
from rest_framework.test import APIClient
from accounts.models import User, Profile
from students.models import Student
from tests.factories import OwnerUserFactory, ParentUserFactory

@pytest.mark.django_db
class TestStudentCreate:
    def test_student_create_with_valid_parent_id_succeeds(self):
        """Creating a student with a valid parent_id links the parent correctly."""
        owner = OwnerUserFactory(is_active=True)
        parent = ParentUserFactory(is_active=True)
        
        client = APIClient()
        client.force_authenticate(user=owner)
        
        payload = {
            "username": "newstudent",
            "password": "Password123!",
            "full_name": "New Student",
            "age": 10,
            "guardian_name": "Test Guardian",
            "guardian_whatsapp": "+1234567890",
            "parent_account_id": parent.id
        }
        
        assert Student.objects.count() == 0
        response = client.post("/api/students/", payload, format="json")
        
        assert response.status_code == 201
        assert Student.objects.count() == 1
        student = Student.objects.first()
        assert student.parent_account_id == parent.id

    def test_student_create_with_invalid_parent_id_returns_400(self):
        """Creating a student with an invalid parent_id returns 400 and creates no records."""
        owner = OwnerUserFactory(is_active=True)
        
        client = APIClient()
        client.force_authenticate(user=owner)
        
        payload = {
            "username": "newstudent2",
            "password": "Password123!",
            "full_name": "New Student 2",
            "age": 10,
            "guardian_name": "Test Guardian",
            "guardian_whatsapp": "+1234567890",
            "parent_account_id": 999999  # Non-existent ID
        }
        
        assert Student.objects.count() == 0
        response = client.post("/api/students/", payload, format="json")
        
        assert response.status_code == 400
        assert "Invalid parent_account_id" in response.data["error"]
        assert Student.objects.count() == 0
        assert User.objects.filter(username="newstudent2").count() == 0

    def test_student_create_without_parent_id_succeeds(self):
        """Creating a student without a parent_id succeeds since it's optional."""
        owner = OwnerUserFactory(is_active=True)
        
        client = APIClient()
        client.force_authenticate(user=owner)
        
        payload = {
            "username": "newstudent3",
            "password": "Password123!",
            "full_name": "New Student 3",
            "age": 10,
            "guardian_name": "Test Guardian",
            "guardian_whatsapp": "+1234567890"
        }
        
        assert Student.objects.count() == 0
        response = client.post("/api/students/", payload, format="json")
        
        assert response.status_code == 201
        assert Student.objects.count() == 1
        student = Student.objects.first()
        assert student.parent_account is None

    def test_student_create_with_invalid_whatsapp_returns_400(self):
        """Creating a student with a malformed E.164 whatsapp number returns 400."""
        owner = OwnerUserFactory(is_active=True)
        
        client = APIClient()
        client.force_authenticate(user=owner)
        
        payload = {
            "username": "newstudent4",
            "password": "Password123!",
            "full_name": "New Student 4",
            "age": 10,
            "guardian_name": "Test Guardian",
            "guardian_whatsapp": "invalid123"
        }
        
        assert Student.objects.count() == 0
        response = client.post("/api/students/", payload, format="json")
        
        assert response.status_code == 400
        assert Student.objects.count() == 0
