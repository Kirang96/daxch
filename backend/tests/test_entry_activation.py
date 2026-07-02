from datetime import datetime, timezone
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from backend.app.models.entities import AgentStatus, Order, OrderStatus
from backend.app.services.entry_fill import activate_agent_after_entry_fill, agent_awaiting_entry_fill
from backend.app.services.positions.order_sync import apply_entry_fill_to_holding, is_order_fully_filled


def test_agent_awaiting_entry_fill_from_config():
    agent = MagicMock()
    agent.agent_config = {"awaiting_entry_fill": True}
    assert agent_awaiting_entry_fill(agent) is True

    agent.agent_config = {"awaiting_entry_fill": False}
    assert agent_awaiting_entry_fill(agent) is False


def test_is_order_fully_filled():
    order = Order(
        decision_id=uuid4(),
        order_type="LIMIT",
        status=OrderStatus.placed,
        price=100.0,
        quantity=10,
        filled_quantity=10,
        broker_status="complete",
    )
    assert is_order_fully_filled(order) is True

    order.filled_quantity = 5
    assert is_order_fully_filled(order) is False


def test_apply_entry_fill_to_holding():
    holding = MagicMock()
    holding.entry_price = 100.0
    holding.quantity = 10
    order = Order(
        decision_id=uuid4(),
        order_type="LIMIT",
        status=OrderStatus.placed,
        price=100.0,
        quantity=10,
        filled_quantity=10,
        average_price=101.25,
    )
    apply_entry_fill_to_holding(holding, order)
    assert holding.entry_price == 101.25
    assert holding.quantity == 10


def test_activate_agent_after_entry_fill_sets_active():
    db = MagicMock()
    agent = MagicMock()
    agent.id = uuid4()
    agent.polling_frequency = 2
    agent.agent_config = {"awaiting_entry_fill": True}
    agent.status = AgentStatus.paused
    agent.next_poll_at = None

    holding = MagicMock()
    holding.user_id = uuid4()
    holding.ticker = "RELIANCE"

    order = Order(
        decision_id=uuid4(),
        order_type="LIMIT",
        status=OrderStatus.placed,
        price=2500.0,
        quantity=5,
        filled_quantity=5,
        average_price=2498.5,
    )

    with patch("backend.app.services.entry_fill.create_notification_event"), patch(
        "backend.app.services.entry_fill.log_event"
    ), patch("backend.app.agents.scheduler._next_poll_time") as mock_next:
        mock_next.return_value = datetime.now(tz=timezone.utc)
        activate_agent_after_entry_fill(db, agent, holding, order)

    assert agent.status == AgentStatus.active
    assert agent.agent_config["awaiting_entry_fill"] is False
    assert agent.next_poll_at is not None


def test_place_and_sync_order_limit_payload():
    from backend.app.services.broker.order_execution import place_and_sync_order

    user = MagicMock()
    user.id = uuid4()
    holding = MagicMock()
    holding.ticker = "INFY"
    holding.exchange = "NSE"
    order = Order(
        decision_id=uuid4(),
        order_type="LIMIT",
        status=OrderStatus.pending,
        price=1500.0,
        quantity=3,
    )
    db = MagicMock()
    broker = MagicMock()
    broker._demo_mode = False
    broker.place_order = AsyncMock(return_value=MagicMock(order_id="brk-123", status="placed"))
    broker.get_order_status = AsyncMock(
        return_value=MagicMock(
            status="open",
            filled_quantity=0,
            pending_quantity=3,
            average_price=None,
            transaction_type="BUY",
        )
    )

    with patch("backend.app.services.broker.order_execution.get_broker", return_value=broker), patch(
        "backend.app.services.broker.order_execution.get_valid_broker_token",
        new_callable=AsyncMock,
        return_value=(MagicMock(), "token"),
    ):
        broker_order_id = asyncio.run(
            place_and_sync_order(
                db,
                user,
                holding,
                order,
                order_type="LIMIT",
                transaction_type="BUY",
                price=1500.0,
            )
        )

    assert broker_order_id == "brk-123"
    broker.place_order.assert_awaited_once()
    call_args = broker.place_order.await_args[0][1]
    assert call_args.order_type == "LIMIT"
    assert call_args.price == 1500.0
