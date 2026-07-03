from datetime import datetime, timezone
from uuid import UUID

from cryptography.fernet import InvalidToken
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.middleware.auth import get_current_user
from backend.app.models.entities import (
    AgentDecision,
    BrokerConnection,
    MonitorAgent,
    NotificationType,
    Order,
    StockHolding,
    User,
)
from backend.app.schemas.agent import BrokerOrderStatus
from backend.app.services.broker.base import BrokerConfigurationError
from backend.app.services.broker.connection import get_user_broker_connection, require_user_broker
from backend.app.services.broker.factory import get_broker, list_supported_brokers
from backend.app.services.broker.order_status import build_order_status_query
from backend.app.services.broker.session import get_valid_broker_token
from backend.app.services.entry_order_state import apply_entry_order_broker_status
from backend.app.services.notification_events import create_notification_event
from backend.app.utils.security import decrypt_value, encrypt_value

router = APIRouter(prefix="/broker", tags=["broker"])

SUPPORTED_BROKER_IDS = {"upstox", "5paisa"}


def _normalize_broker_name(broker_name: str) -> str:
    normalized = broker_name.lower().strip()
    if normalized not in SUPPORTED_BROKER_IDS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unsupported broker")
    return normalized


def _upsert_connection(
    db: Session,
    user: User,
    broker_name: str,
    token_pair,
) -> BrokerConnection:
    existing = db.execute(select(BrokerConnection).where(BrokerConnection.user_id == user.id)).scalar_one_or_none()
    metadata = dict(token_pair.metadata or {})
    if existing:
        existing.broker_name = broker_name
        existing.access_token = encrypt_value(token_pair.access_token)
        existing.refresh_token = encrypt_value(token_pair.refresh_token or "")
        existing.token_expiry = token_pair.expires_at
        existing.connection_metadata = metadata
        connection = existing
    else:
        connection = BrokerConnection(
            user_id=user.id,
            broker_name=broker_name,
            access_token=encrypt_value(token_pair.access_token),
            refresh_token=encrypt_value(token_pair.refresh_token or ""),
            token_expiry=token_pair.expires_at,
            connection_metadata=metadata,
        )
        db.add(connection)
    return connection


@router.get("/supported")
def supported_brokers() -> dict:
    return {"items": [meta.__dict__ for meta in list_supported_brokers()]}


@router.get("/{broker_name}/auth-url")
def broker_auth_url(broker_name: str, state: str = "daxch") -> dict:
    name = _normalize_broker_name(broker_name)
    broker = get_broker(name)
    try:
        if name == "5paisa" and hasattr(broker, "get_oauth_start"):
            oauth = broker.get_oauth_start(state)
            url = str(oauth["url"])
            method = str(oauth.get("method") or "GET")
            fields = oauth.get("fields") if isinstance(oauth.get("fields"), dict) else {}
        else:
            url = broker.get_auth_url(state)
            method = "GET"
            fields = {}
    except BrokerConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    redirect_uri = None
    if name == "upstox":
        from backend.app.core.config import get_settings

        redirect_uri = get_settings().upstox_redirect_uri
    elif name == "5paisa":
        from backend.app.core.config import get_settings

        redirect_uri = get_settings().fivepaisa_redirect_uri
    return {
        "url": url,
        "method": method,
        "fields": fields,
        "redirect_uri": redirect_uri,
        "broker": name,
    }


@router.post("/{broker_name}/callback")
async def connect_broker(
    broker_name: str,
    code: str | None = Query(default=None),
    request_token: str | None = Query(default=None, alias="RequestToken"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    name = _normalize_broker_name(broker_name)
    auth_value = request_token if name == "5paisa" else code
    if not auth_value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing broker auth token")

    broker = get_broker(name)
    try:
        token_pair = await broker.authenticate(auth_value)
    except BrokerConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    _upsert_connection(db, current_user, name, token_pair)
    db.commit()
    create_notification_event(
        db,
        current_user.id,
        NotificationType.system,
        "Broker connected",
        f"{name} connection has been established successfully.",
        {"broker": name},
    )
    db.commit()
    return {"connected": True, "broker": name}


@router.post("/{broker_name}/refresh")
async def refresh_broker_token(
    broker_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    name = _normalize_broker_name(broker_name)
    connection = db.execute(select(BrokerConnection).where(BrokerConnection.user_id == current_user.id)).scalar_one_or_none()
    if not connection or connection.broker_name != name:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Broker connection not found")

    broker = get_broker(connection.broker_name)
    try:
        refresh_token = decrypt_value(connection.refresh_token)
    except InvalidToken as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Invalid stored broker session.") from exc

    try:
        token_pair = await broker.refresh_token(refresh_token)
    except BrokerConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    connection.access_token = encrypt_value(token_pair.access_token)
    connection.refresh_token = encrypt_value(token_pair.refresh_token or "")
    connection.token_expiry = token_pair.expires_at
    if token_pair.metadata:
        connection.connection_metadata = {**(connection.connection_metadata or {}), **token_pair.metadata}
    create_notification_event(
        db,
        current_user.id,
        NotificationType.system,
        "Broker token refreshed",
        f"Your {connection.broker_name} broker token was refreshed successfully.",
        {"broker": connection.broker_name, "expires_at": connection.token_expiry.isoformat()},
    )
    db.commit()
    return {"refreshed": True, "expires_at": connection.token_expiry}


@router.get("/upstox/auth-url")
def upstox_auth_url(state: str = "daxch") -> dict:
    return broker_auth_url("upstox", state)


@router.post("/upstox/callback")
async def connect_upstox(
    code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    return await connect_broker("upstox", code=code, db=db, current_user=current_user)


@router.post("/upstox/refresh")
async def refresh_upstox_token(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    return await refresh_broker_token("upstox", db=db, current_user=current_user)


@router.get("/connection-status")
def connection_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    connection = get_user_broker_connection(db, current_user.id)
    if not connection:
        return {"connected": False}

    return {
        "connected": True,
        "broker": connection.broker_name,
        "expires_at": connection.token_expiry,
        "expired": connection.token_expiry < datetime.now(tz=timezone.utc),
    }


@router.get("/funds")
async def broker_funds(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    connection, broker = require_user_broker(db, current_user.id)
    try:
        _, token = await get_valid_broker_token(db=db, user=current_user, broker=broker)
        metadata = connection.connection_metadata or {}
        client_code = metadata.get("client_code")
        if isinstance(client_code, str):
            client_code = client_code.strip() or None
        else:
            client_code = None
        summary = await broker.get_available_funds(token, client_code=client_code)
    except BrokerConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    return {
        "broker": connection.broker_name,
        "available_margin": summary.available_margin,
        "ledger_balance": summary.ledger_balance,
        "currency": summary.currency,
        "fetched_at": summary.as_of.isoformat(),
    }


@router.get("/orders/{order_id}/status", response_model=BrokerOrderStatus)
async def get_order_status(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BrokerOrderStatus:
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

    connection = get_user_broker_connection(db, current_user.id)
    if not connection:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Broker not connected")

    broker = get_broker(connection.broker_name)
    try:
        _, token = await get_valid_broker_token(db=db, user=current_user, broker=broker)
        live = await broker.get_order_status(token, build_order_status_query(connection, order, holding))
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
