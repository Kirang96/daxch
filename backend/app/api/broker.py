from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.core.config import get_settings
from backend.app.middleware.auth import get_current_user
from backend.app.models.entities import (
    AgentDecision,
    BrokerConnection,
    MonitorAgent,
    NotificationType,
    Order,
    OrderStatus,
    StockHolding,
    User,
)
from backend.app.schemas.agent import BrokerOrderStatus
from backend.app.services.broker.factory import get_broker
from backend.app.services.broker.upstox import BrokerConfigurationError
from backend.app.services.entry_order_state import apply_entry_order_broker_status
from backend.app.services.broker.session import get_valid_broker_token
from backend.app.services.notification_events import create_notification_event
from backend.app.db.session import get_db
from backend.app.utils.security import decrypt_value, encrypt_value

router = APIRouter(prefix="/broker", tags=["broker"])
settings = get_settings()


@router.get("/upstox/auth-url")
def upstox_auth_url(state: str = "daxch") -> dict:
    if not settings.upstox_client_id or not settings.upstox_redirect_uri:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Upstox OAuth is not configured.")

    url = (
        "https://api.upstox.com/v2/login/authorization/dialog"
        f"?response_type=code&client_id={settings.upstox_client_id}"
        f"&redirect_uri={settings.upstox_redirect_uri}&state={state}"
    )
    return {
        "url": url,
        "redirect_uri": settings.upstox_redirect_uri,
    }


@router.post("/upstox/callback")
async def connect_upstox(
    code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    broker = get_broker("upstox")
    try:
        token_pair = await broker.authenticate(code)
    except BrokerConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    stmt = select(BrokerConnection).where(BrokerConnection.user_id == current_user.id)
    existing = db.execute(stmt).scalar_one_or_none()
    if existing:
        existing.access_token = encrypt_value(token_pair.access_token)
        existing.refresh_token = encrypt_value(token_pair.refresh_token)
        existing.token_expiry = token_pair.expires_at
    else:
        db.add(
            BrokerConnection(
            user_id=current_user.id,
            broker_name="upstox",
            access_token=encrypt_value(token_pair.access_token),
            refresh_token=encrypt_value(token_pair.refresh_token),
            token_expiry=token_pair.expires_at,
            )
        )

    db.commit()
    create_notification_event(
        db,
        current_user.id,
        NotificationType.system,
        "Broker connected",
        "Upstox connection has been established successfully.",
        {"broker": "upstox"},
    )
    db.commit()
    return {"connected": True, "broker": "upstox"}


@router.post("/upstox/refresh")
async def refresh_upstox_token(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    connection = db.execute(select(BrokerConnection).where(BrokerConnection.user_id == current_user.id)).scalar_one_or_none()
    if not connection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Broker connection not found")

    broker = get_broker(connection.broker_name)
    refresh_token = decrypt_value(connection.refresh_token)
    try:
        token_pair = await broker.refresh_token(refresh_token)
    except BrokerConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    connection.access_token = encrypt_value(token_pair.access_token)
    connection.refresh_token = encrypt_value(token_pair.refresh_token)
    connection.token_expiry = token_pair.expires_at
    create_notification_event(
        db,
        current_user.id,
        NotificationType.system,
        "Broker token refreshed",
        "Your Upstox broker token was refreshed successfully.",
        {"broker": connection.broker_name, "expires_at": connection.token_expiry.isoformat()},
    )
    db.commit()
    return {"refreshed": True, "expires_at": connection.token_expiry}


@router.get("/connection-status")
def connection_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    stmt = select(BrokerConnection).where(BrokerConnection.user_id == current_user.id)
    connection = db.execute(stmt).scalar_one_or_none()
    if not connection:
        return {"connected": False}

    return {
        "connected": True,
        "broker": connection.broker_name,
        "expires_at": connection.token_expiry,
        "expired": connection.token_expiry < datetime.now(tz=timezone.utc),
    }


@router.get("/orders/{order_id}/status", response_model=BrokerOrderStatus)
async def get_order_status(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BrokerOrderStatus:
    """Fetch live order status from the broker and sync it back to the DB."""
    # Verify the order belongs to this user via decision → agent → holding chain
    stmt = (
        select(Order, MonitorAgent, StockHolding)
        .join(AgentDecision, Order.decision_id == AgentDecision.id)
        .join(MonitorAgent, AgentDecision.agent_id == MonitorAgent.id)
        .join(StockHolding, MonitorAgent.holding_id == StockHolding.id)
        .where(Order.id == UUID(order_id), StockHolding.user_id == current_user.id)
    )
    row = db.execute(stmt).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    order, agent, holding = row

    if not order.broker_order_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="This order has no broker order ID — it may not have been placed yet.",
        )

    connection = db.execute(
        select(BrokerConnection).where(BrokerConnection.user_id == current_user.id)
    ).scalar_one_or_none()
    if not connection:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Broker not connected")

    broker = get_broker(connection.broker_name)
    try:
        _, token = await get_valid_broker_token(db=db, user=current_user, broker=broker)
        live = await broker.get_order_status(order.broker_order_id, token)
    except BrokerConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    apply_entry_order_broker_status(
        db,
        agent=agent,
        holding=holding,
        order=order,
        live=live,
        notify=False,
    )
    db.commit()

    return BrokerOrderStatus(
        order_id=order.id,
        broker_order_id=order.broker_order_id,
        internal_status=order.status.value,
        broker_status=live.status,
        filled_quantity=live.filled_quantity,
        pending_quantity=live.pending_quantity,
        average_price=live.average_price,
        exchange_order_id=live.exchange_order_id,
        transaction_type=live.transaction_type,
        ticker=live.ticker,
        message=live.message,
    )
