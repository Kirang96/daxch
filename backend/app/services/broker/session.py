from datetime import datetime, timezone
from uuid import UUID

from cryptography.fernet import InvalidToken
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.models.entities import BrokerConnection, User
from backend.app.services.broker.base import BaseBroker
from backend.app.services.broker.upstox import BrokerConfigurationError
from backend.app.utils.security import decrypt_value, encrypt_value


async def get_valid_broker_token_for_user(
    *,
    db: Session,
    user_id: UUID,
    broker: BaseBroker,
) -> tuple[BrokerConnection, str]:
    connection = db.execute(select(BrokerConnection).where(BrokerConnection.user_id == user_id)).scalar_one_or_none()
    if not connection:
        raise BrokerConfigurationError("Connect Upstox before using market data.")

    try:
        token = decrypt_value(connection.access_token)
    except InvalidToken as exc:
        raise BrokerConfigurationError(
            "Stored broker session is invalid. Reconnect your Upstox account."
        ) from exc

    if connection.token_expiry > datetime.now(tz=timezone.utc):
        return connection, token

    try:
        refresh_token_value = decrypt_value(connection.refresh_token)
    except InvalidToken as exc:
        raise BrokerConfigurationError(
            "Stored broker session is invalid. Reconnect your Upstox account."
        ) from exc

    refreshed = await broker.refresh_token(refresh_token_value)
    connection.access_token = encrypt_value(refreshed.access_token)
    connection.refresh_token = encrypt_value(refreshed.refresh_token)
    connection.token_expiry = refreshed.expires_at
    db.commit()
    return connection, refreshed.access_token


async def get_valid_broker_token(
    *,
    db: Session,
    user: User,
    broker: BaseBroker,
) -> tuple[BrokerConnection, str]:
    try:
        return await get_valid_broker_token_for_user(db=db, user_id=user.id, broker=broker)
    except BrokerConfigurationError as exc:
        detail = str(exc)
        if "Connect Upstox" in detail:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail) from exc
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=detail) from exc

