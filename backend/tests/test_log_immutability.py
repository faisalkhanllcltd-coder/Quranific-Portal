import pytest
from django.db import InternalError
from log.models import SystemLog

@pytest.mark.django_db(transaction=True)
class TestSystemLogImmutability:
    def test_system_log_insert_succeeds(self):
        """Confirm that creating a new log entry works normally."""
        assert SystemLog.objects.count() == 0
        log = SystemLog.objects.create(action="TEST_ACTION", details="Test details")
        assert SystemLog.objects.count() == 1
        assert log.action == "TEST_ACTION"

    def test_system_log_update_fails(self):
        """Confirm that updating an existing log entry raises a database exception."""
        log = SystemLog.objects.create(action="TEST_ACTION", details="Test details")
        
        with pytest.raises(InternalError) as exc_info:
            SystemLog.objects.filter(id=log.id).update(action="UPDATED_ACTION")
            
        assert "SystemLog records are immutable" in str(exc_info.value)
        
        # Verify the record was not changed
        log.refresh_from_db()
        assert log.action == "TEST_ACTION"

    def test_system_log_delete_fails(self):
        """Confirm that deleting an existing log entry raises a database exception."""
        log = SystemLog.objects.create(action="TEST_ACTION", details="Test details")
        
        with pytest.raises(InternalError) as exc_info:
            SystemLog.objects.filter(id=log.id).delete()
            
        assert "SystemLog records are immutable" in str(exc_info.value)
        
        # Verify the record was not deleted
        assert SystemLog.objects.filter(id=log.id).exists()
