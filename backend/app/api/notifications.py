from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.middleware.auth import get_current_user
from backend.app.models.entities import DeviceToken, NotificationEvent, NotificationType, User
from backend.app.schemas.device_token import DeviceTokenRegisterRequest, DeviceTokenResponse
from backend.app.schemas.notification import NotificationMarkReadResponse, NotificationResponse
from backend.app.services.notification import NotificationDeliveryError, NotificationService

router = APIRouter(prefix="/notifications", tags=["notifications"])
notification_service = NotificationService()


@router.post("/devices", response_model=DeviceTokenResponse)
def register_device_token(
    payload: DeviceTokenRegisterRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DeviceTokenResponse:
    existing = db.execute(
        select(DeviceToken).where(DeviceToken.user_id == current_user.id, DeviceToken.token == payload.token)
    ).scalar_one_or_none()
    if existing:
        existing.platform = payload.platform
    else:
        db.add(DeviceToken(user_id=current_user.id, token=payload.token, platform=payload.platform))
    db.commit()
    return DeviceTokenResponse(registered=True)


@router.delete("/devices/{token}", response_model=DeviceTokenResponse)
def unregister_device_token(
    token: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DeviceTokenResponse:
    existing = db.execute(
        select(DeviceToken).where(DeviceToken.user_id == current_user.id, DeviceToken.token == token)
    ).scalar_one_or_none()
    if existing:
        db.delete(existing)
        db.commit()
    return DeviceTokenResponse(registered=False)


@router.get("", response_model=list[NotificationResponse])
def list_notifications(
    event_type: str | None = Query(default=None),
    only_unread: bool = Query(default=False),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[NotificationResponse]:
    stmt = (
        select(NotificationEvent)
        .where(NotificationEvent.user_id == current_user.id)
        .order_by(NotificationEvent.created_at.desc())
        .limit(limit)
    )
    events = db.execute(stmt).scalars().all()
    if event_type:
        events = [event for event in events if event.event_type.value == event_type]
    if only_unread:
        events = [event for event in events if event.read_at is None]
    return [NotificationResponse.model_validate(event) for event in events]


@router.post("/{notification_id}/read", response_model=NotificationMarkReadResponse)
def mark_notification_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotificationMarkReadResponse:
    event = db.get(NotificationEvent, UUID(notification_id))
    if not event or event.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    event.read_at = datetime.now(tz=timezone.utc)
    db.commit()
    return NotificationMarkReadResponse(updated=True)


@router.post("/test")
async def send_test_notification(
    title: str,
    body: str,
    device_tokens: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    if device_tokens:
        tokens = [token.strip() for token in device_tokens.split(",") if token.strip()]
    else:
        tokens = [
            row.token
            for row in db.execute(select(DeviceToken).where(DeviceToken.user_id == current_user.id)).scalars().all()
        ]
    try:
        await notification_service.send_push(str(current_user.id), title, body, payload={"kind": "test"}, device_tokens=tokens)
    except NotificationDeliveryError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    event = NotificationEvent(
        user_id=current_user.id,
        event_type=NotificationType.system,
        title=title,
        body=body,
        payload={"kind": "test"},
    )
    db.add(event)
    db.commit()
    return {"sent": True, "token_count": len(tokens)}

