from celery import Celery

from backend.app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "daxch",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Kolkata",
    enable_utc=False,
    beat_schedule={
        "dispatch-due-agent-polls": {
            "task": "backend.app.agents.scheduler.dispatch_due_agents",
            "schedule": 60.0,
        },
        "auto-execute-expired-confirmations": {
            "task": "backend.app.agents.monitor_task.auto_execute_expired_confirmations",
            "schedule": 60.0,
        },
        "poll-pending-entry-orders": {
            "task": "backend.app.agents.entry_order_task.poll_pending_entry_orders",
            "schedule": 60.0,
        },
    },
)

celery_app.autodiscover_tasks(["backend.app.agents"])

# Register tasks defined in scheduler/monitor_task (not tasks.py).
from backend.app.agents import entry_order_task, monitor_task, scheduler  # noqa: E402, F401

