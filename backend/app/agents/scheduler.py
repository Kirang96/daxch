from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select

from backend.app.agents.celery_app import celery_app
from backend.app.db.session import SessionLocal
from backend.app.models.entities import AgentStatus, MonitorAgent

IST = ZoneInfo("Asia/Kolkata")
MARKET_OPEN_MIN = 9 * 60 + 15
MARKET_CLOSE_MIN = 15 * 60 + 30


def _next_poll_time(frequency: int, now: datetime | None = None) -> datetime:
    now = now or datetime.now(tz=timezone.utc)
    now_ist = now.astimezone(IST)

    if now_ist.weekday() >= 5:
        days = 7 - now_ist.weekday()
        target = (now_ist + timedelta(days=days)).replace(hour=9, minute=30, second=0, microsecond=0)
        return target.astimezone(timezone.utc)

    if frequency <= 1:
        frequency = 2

    slots = []
    if frequency == 2:
        slots = [(9, 30), (15, 0)]
    else:
        span = MARKET_CLOSE_MIN - MARKET_OPEN_MIN
        for idx in range(frequency):
            minute = round(MARKET_OPEN_MIN + idx * (span / (frequency - 1)))
            slots.append((minute // 60, minute % 60))

    for hour, minute in slots:
        slot = now_ist.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if slot > now_ist:
            return slot.astimezone(timezone.utc)

    tomorrow = now_ist + timedelta(days=1)
    while tomorrow.weekday() >= 5:
        tomorrow += timedelta(days=1)
    first_hour, first_minute = slots[0]
    target = tomorrow.replace(hour=first_hour, minute=first_minute, second=0, microsecond=0)
    return target.astimezone(timezone.utc)


@celery_app.task(name="backend.app.agents.scheduler.dispatch_due_agents")
def dispatch_due_agents() -> int:
    now = datetime.now(tz=timezone.utc)
    dispatched = 0
    with SessionLocal() as db:
        stmt = select(MonitorAgent).where(
            MonitorAgent.status == AgentStatus.active,
            MonitorAgent.next_poll_at.is_not(None),
            MonitorAgent.next_poll_at <= now,
        )
        due_agents = db.execute(stmt).scalars().all()

        for agent in due_agents:
            celery_app.send_task("backend.app.agents.monitor_task.run_monitoring_cycle", args=[str(agent.id)])
            agent.next_poll_at = _next_poll_time(agent.polling_frequency, now=now)
            dispatched += 1

        db.commit()

    return dispatched

