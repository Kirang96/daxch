from sqlalchemy.orm import Session

from backend.app.models.entities import Order, OrderStatus, StockHolding, User
from backend.app.services.broker.base import BrokerConfigurationError, OrderRequest
from backend.app.services.broker.connection import require_user_broker
from backend.app.services.broker.order_status import build_order_status_query, merge_order_broker_metadata
from backend.app.services.broker.session import get_valid_broker_token
from backend.app.services.positions.order_sync import sync_order_from_broker_status


class OrderPlacementError(RuntimeError):
    def __init__(self, message: str, *, broker_error: bool = False) -> None:
        super().__init__(message)
        self.broker_error = broker_error


async def place_and_sync_order(
    db: Session,
    user: User,
    holding: StockHolding,
    order: Order,
    *,
    order_type: str,
    transaction_type: str,
    price: float | None = None,
) -> str:
    """Place order with broker and best-effort sync fill status. Returns broker order id."""
    connection, broker = require_user_broker(db, user.id)
    if broker._demo_mode:  # noqa: SLF001
        raise OrderPlacementError(
            "Real broker orders are disabled in demo mode. Connect broker credentials to place orders.",
            broker_error=True,
        )

    if order_type.upper() == "LIMIT" and (price is None or price <= 0):
        raise OrderPlacementError("LIMIT orders require a positive price.")

    if order.transaction_type is None:
        order.transaction_type = transaction_type.upper()

    req = OrderRequest(
        ticker=holding.ticker,
        exchange=holding.exchange,
        transaction_type=transaction_type.upper(),
        quantity=order.quantity,
        order_type=order_type.upper(),
        price=price,
        remote_order_id=str(order.id),
    )

    try:
        _, token = await get_valid_broker_token(db=db, user=user, broker=broker)
        result = await broker.place_order(token, req)
    except BrokerConfigurationError as exc:
        order.status = OrderStatus.failed
        raise OrderPlacementError(str(exc), broker_error=True) from exc
    except Exception as exc:  # noqa: BLE001
        order.status = OrderStatus.failed
        raise OrderPlacementError(f"Order placement failed: {exc}", broker_error=True) from exc

    order.broker_order_id = result.order_id
    order.status = OrderStatus.placed
    merge_order_broker_metadata(
        order,
        remote_order_id=str(order.id),
        exchange_order_id=result.exchange_order_id,
        broker_name=connection.broker_name,
    )
    try:
        live = await broker.get_order_status(
            token,
            build_order_status_query(connection, order, holding),
        )
        sync_order_from_broker_status(order, live)
        if live.exchange_order_id:
            merge_order_broker_metadata(order, exchange_order_id=live.exchange_order_id)
    except Exception:
        pass

    return result.order_id
