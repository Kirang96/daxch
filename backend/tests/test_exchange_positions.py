from uuid import uuid4

from backend.app.services.positions.exchange import ExchangePosition, aggregate_portfolio_summary


def test_aggregate_portfolio_summary_sums_active_positions():
    positions = [
        ExchangePosition(
            holding_id=uuid4(),
            ticker="RELIANCE",
            exchange="NSE",
            net_quantity=10,
            average_cost=100.0,
            invested=1000.0,
            market_value=1100.0,
            unrealized_pnl=100.0,
            unrealized_pnl_pct=10.0,
            has_exchange_position=True,
        ),
        ExchangePosition(
            holding_id=uuid4(),
            ticker="INFY",
            exchange="NSE",
            net_quantity=0,
            average_cost=0.0,
            invested=0.0,
            market_value=None,
            unrealized_pnl=None,
            unrealized_pnl_pct=None,
            has_exchange_position=False,
        ),
    ]
    summary = aggregate_portfolio_summary(positions)
    assert summary["has_exchange_positions"] is True
    assert summary["invested"] == 1000.0
    assert summary["market_value"] == 1100.0
    assert summary["unrealized_pnl"] == 100.0
    assert summary["position_count"] == 1


def test_is_filled_order_logic_via_sync():
    from backend.app.models.entities import Order, OrderStatus
    from backend.app.services.broker.base import OrderStatusResponse
    from backend.app.services.positions.order_sync import sync_order_from_broker_status

    order = Order(
        decision_id=uuid4(),
        order_type="buy_more",
        status=OrderStatus.pending,
        price=100.0,
        quantity=5,
    )
    live = OrderStatusResponse(
        broker_order_id="broker-1",
        status="complete",
        filled_quantity=5,
        pending_quantity=0,
        average_price=101.5,
        exchange_order_id=None,
        transaction_type="BUY",
        ticker="RELIANCE",
        message=None,
    )
    sync_order_from_broker_status(order, live)
    assert order.filled_quantity == 5
    assert order.average_price == 101.5
    assert order.transaction_type == "BUY"
    assert order.broker_status == "complete"
    assert order.filled_at is not None
