from backend.app.models.entities import BrokerConnection, Order, StockHolding
from backend.app.services.broker.base import OrderStatusQuery


def build_order_status_query(
    connection: BrokerConnection,
    order: Order,
    holding: StockHolding | None = None,
) -> OrderStatusQuery:
    conn_meta = connection.connection_metadata or {}
    order_meta = order.broker_metadata or {}
    exchange = holding.exchange if holding else None
    return OrderStatusQuery(
        broker_order_id=order.broker_order_id or "",
        remote_order_id=str(order.id),
        exchange=exchange,
        client_code=conn_meta.get("client_code"),
    )


def merge_order_broker_metadata(order: Order, **fields: object) -> None:
    current = dict(order.broker_metadata or {})
    for key, value in fields.items():
        if value is not None:
            current[key] = value
    order.broker_metadata = current
