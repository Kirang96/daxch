from datetime import datetime, timezone

from backend.app.models.entities import Order, OrderStatus, StockHolding
from backend.app.services.broker.base import OrderStatusResponse

FILLED_BROKER_STATUSES = frozenset({"complete", "filled", "trade_complete"})
TERMINAL_BROKER_STATUSES = frozenset({"complete", "filled", "trade_complete", "rejected", "cancelled", "canceled", "failed"})


def sync_order_from_broker_status(order: Order, live: OrderStatusResponse) -> None:
    """Persist broker fill fields on the order row."""
    status_map = {
        "complete": OrderStatus.placed,
        "filled": OrderStatus.placed,
        "trade_complete": OrderStatus.placed,
        "open": OrderStatus.pending,
        "pending": OrderStatus.pending,
        "rejected": OrderStatus.failed,
        "cancelled": OrderStatus.cancelled,
        "modified": OrderStatus.pending,
    }
    broker_status = (live.status or "").lower()
    new_status = status_map.get(broker_status, order.status)
    order.status = new_status
    order.broker_status = live.status

    if live.transaction_type:
        order.transaction_type = live.transaction_type.upper()

    if live.filled_quantity and live.filled_quantity > 0:
        order.filled_quantity = live.filled_quantity
    if live.average_price is not None:
        order.average_price = live.average_price

    if broker_status in FILLED_BROKER_STATUSES and order.filled_quantity > 0:
        if order.filled_at is None:
            order.filled_at = datetime.now(tz=timezone.utc)


def is_order_fully_filled(order: Order) -> bool:
    broker_status = (order.broker_status or "").lower()
    if broker_status in FILLED_BROKER_STATUSES and order.filled_quantity >= order.quantity:
        return True
    return order.filled_quantity > 0 and order.filled_quantity >= order.quantity


def is_order_terminal(order: Order) -> bool:
    if order.status in (OrderStatus.failed, OrderStatus.cancelled):
        return True
    broker_status = (order.broker_status or "").lower()
    return broker_status in TERMINAL_BROKER_STATUSES


def apply_entry_fill_to_holding(holding: StockHolding, order: Order) -> None:
    """Update planned holding fields from a filled entry order."""
    if order.average_price is not None:
        holding.entry_price = order.average_price
    elif order.price:
        holding.entry_price = order.price
    if order.filled_quantity > 0:
        holding.quantity = order.filled_quantity
