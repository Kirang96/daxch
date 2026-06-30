import asyncio

from sqlalchemy.orm import Session

from backend.app.models.entities import DeviceToken, NotificationEvent, NotificationType, UserSettings
from backend.app.services.notification import NotificationService


def create_notification_event(  # type: ignore[no-untyped-def]
    db: Session,
    user_id,
    event_type: NotificationType,
    title: str,
    body: str,
    payload: dict | None = None,
) -> NotificationEvent:
    event = NotificationEvent(
        user_id=user_id,
        event_type=event_type,
        title=title,
        body=body,
        payload=payload or {},
    )
    db.add(event)

    settings_row = db.query(UserSettings).filter(UserSettings.user_id == user_id).one_or_none()
    prefs = settings_row.notification_preferences if settings_row else {}
    alerts_enabled = prefs.get("agent_conclusion_updates", True)

    tokens: list[str] = []
    if alerts_enabled:
        tokens = [row.token for row in db.query(DeviceToken).filter(DeviceToken.user_id == user_id).all()]
    if tokens:
        service = NotificationService()
        coroutine = service.send_push(
            user_id=str(user_id),
            title=title,
            body=body,
            payload={"event_type": event_type.value, **(payload or {})},
            device_tokens=tokens,
    )
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(coroutine)
        except RuntimeError:
            asyncio.run(coroutine)

    return event

