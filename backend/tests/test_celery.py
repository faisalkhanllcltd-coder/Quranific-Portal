import pytest
from config.tasks import healthcheck_task

def test_celery_healthcheck_task():
    """
    Proves the entire Celery chain (settings -> app registration -> task discovery)
    works and the task can be executed eagerly.
    """
    result = healthcheck_task.delay()
    assert result.get() == "ok"
    assert result.status == "SUCCESS"
