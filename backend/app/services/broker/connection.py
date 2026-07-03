from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.models.entities import BrokerConnection
from backend.app.services.broker.base import BaseBroker, BrokerConfigurationError
from backend.app.services.broker.factory import get_broker


def get_user_broker_connection(db: Session, user_id: UUID) -> BrokerConnection | None:
    return db.execute(select(BrokerConnection).where(BrokerConnection.user_id == user_id)).scalar_one_or_none()


def require_user_broker(db: Session, user_id: UUID) -> tuple[BrokerConnection, BaseBroker]:
    connection = get_user_broker_connection(db, user_id)
    if not connection:
        raise BrokerConfigurationError("Connect your broker before using market data.")
    return connection, get_broker(connection.broker_name)
