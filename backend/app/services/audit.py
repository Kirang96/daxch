from sqlalchemy.orm import Session

from backend.app.models.entities import AuditLog


def log_event(db: Session, agent_id, event_type: str, payload: dict) -> None:  # type: ignore[no-untyped-def]
    db.add(AuditLog(agent_id=agent_id, event_type=event_type, payload=payload))

