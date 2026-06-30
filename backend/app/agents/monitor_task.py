import asyncio
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select

from backend.app.agents.celery_app import celery_app
from backend.app.agents.decision_engine import confirmation_deadline, should_auto_execute
from backend.app.db.session import SessionLocal
from backend.app.models.entities import (
    AgentDecision,
    BrokerConnection,
    ConfirmationStatus,
    DecisionType,
    HoldingStatus,
    MonitorAgent,
    NotificationType,
    Order,
    OrderStatus,
    StockHolding,
    User,
)
from backend.app.services.ai.analyst import AIConfigurationError
from backend.app.services.ai.monitor import MonitoringService
from backend.app.services.ai.user_model import get_resolved_ai_model
from backend.app.services.audit import log_event
from backend.app.services.broker.base import OrderRequest
from backend.app.services.broker.factory import get_broker
from backend.app.services.broker.session import get_valid_broker_token_for_user
from backend.app.services.broker.upstox import BrokerConfigurationError
from backend.app.services.ai_units.exceptions import AiQuotaExceededError
from backend.app.services.ai_units.pricing import compute_units
from backend.app.services.ai_units.service import AiUnitsService, UsageEventInput
from backend.app.services.notification_events import create_notification_event
from backend.app.services.positions.order_sync import sync_order_from_broker_status


async def _run_monitoring(agent_id: str) -> None:
    monitoring_service = MonitoringService()
    with SessionLocal() as db:
        agent = db.get(MonitorAgent, UUID(agent_id))
        if not agent:
            return
        holding = db.get(StockHolding, agent.holding_id)
        if not holding:
            return

        portfolio_stmt = select(StockHolding).where(
            StockHolding.user_id == holding.user_id,
            StockHolding.status == HoldingStatus.active,
        )
        active_holdings = db.execute(portfolio_stmt).scalars().all()

        market_snapshot = {"ltp": holding.entry_price, "volatility": "normal"}
        portfolio_snapshot = {
            "active_holdings": len(active_holdings),
            "total_quantity": sum(h.quantity for h in active_holdings),
        }
        connection = db.execute(select(BrokerConnection).where(BrokerConnection.user_id == holding.user_id)).scalar_one_or_none()
        if not connection:
            log_event(
                db,
                agent.id,
                "monitoring_skipped",
                {"reason": "missing_broker_connection", "ticker": holding.ticker},
            )
            create_notification_event(
                db,
                holding.user_id,
                NotificationType.risk,
                f"{holding.ticker}: monitoring paused",
                "Connect your broker to resume live monitoring decisions.",
                {"agent_id": str(agent.id), "ticker": holding.ticker},
            )
            db.commit()
            return

        broker = get_broker(connection.broker_name)
        try:
            _, token = await get_valid_broker_token_for_user(db=db, user_id=holding.user_id, broker=broker)
            live_quote = await broker.get_quote(ticker=holding.ticker, exchange=holding.exchange, access_token=token)
        except BrokerConfigurationError as exc:
            log_event(
                db,
                agent.id,
                "monitoring_skipped",
                {"reason": "broker_data_unavailable", "ticker": holding.ticker, "error": str(exc)},
            )
            create_notification_event(
                db,
                holding.user_id,
                NotificationType.risk,
                f"{holding.ticker}: monitoring data unavailable",
                "Could not fetch live broker quote. Monitoring skipped for this cycle.",
                {"agent_id": str(agent.id), "ticker": holding.ticker},
            )
            db.commit()
            return

        market_snapshot = {"ltp": live_quote.ltp, "change_percent": live_quote.change_percent, "volatility": "normal"}

        user = db.get(User, holding.user_id)
        ai_model = get_resolved_ai_model(db, user) if user else "gpt-4o-mini"

        if user:
            try:
                min_units = AiUnitsService.estimate_monitoring_units_per_poll(ai_model)
                AiUnitsService.check_quota(db, user, min_units=min_units)
            except AiQuotaExceededError:
                log_event(
                    db,
                    agent.id,
                    "monitoring_skipped",
                    {"reason": "quota_exhausted", "ticker": holding.ticker},
                )
                create_notification_event(
                    db,
                    holding.user_id,
                    NotificationType.system,
                    f"{holding.ticker}: monitoring paused",
                    "AI Units exhausted. Buy more units on the Subscription page to resume monitoring.",
                    {"agent_id": str(agent.id), "ticker": holding.ticker},
                )
                db.commit()
                return

        try:
            analysis, usage = await monitoring_service.evaluate_position(
                ticker=holding.ticker,
                intention=holding.intention,
                entry_price=holding.entry_price,
                quantity=holding.quantity,
                market_snapshot=market_snapshot,
                portfolio_snapshot=portfolio_snapshot,
                model=ai_model,
            )
        except AIConfigurationError as exc:
            log_event(
                db,
                agent.id,
                "monitoring_skipped",
                {"reason": "ai_unavailable", "ticker": holding.ticker, "error": str(exc)},
            )
            create_notification_event(
                db,
                holding.user_id,
                NotificationType.risk,
                f"{holding.ticker}: AI unavailable",
                "Monitoring decision skipped because AI provider is not configured.",
                {"agent_id": str(agent.id), "ticker": holding.ticker},
            )
            db.commit()
            return

        if user and usage is not None:
            units = compute_units(
                prompt_tokens=usage.prompt_tokens,
                completion_tokens=usage.completion_tokens,
                model=ai_model,
            )
            if units > 0:
                AiUnitsService.record_usage(
                    db,
                    user,
                    UsageEventInput(
                        operation_type="monitoring",
                        model=ai_model,
                        units_charged=units,
                        prompt_tokens=usage.prompt_tokens,
                        completion_tokens=usage.completion_tokens,
                        agent_id=agent.id,
                        ticker=holding.ticker,
                    ),
                )

        decision = AgentDecision(
            agent_id=agent.id,
            decision_type=DecisionType(analysis["decision_type"]),
            reasoning=f"{analysis['reasoning']}\n\n{analysis['disclaimer']}",
            analysis_data=analysis,
            confirmation_status=ConfirmationStatus.pending,
            confirmation_deadline=confirmation_deadline(agent.agent_config),
            decided_at=datetime.now(tz=timezone.utc),
        )
        db.add(decision)
        db.flush()

        if analysis["decision_type"] == "hold":
            decision.confirmation_status = ConfirmationStatus.approved
            decision.confirmed_at = datetime.now(tz=timezone.utc)
            log_event(
                db,
                agent.id,
                "decision_hold",
                {"decision_id": str(decision.id), "reasoning": analysis["reasoning"], "ticker": holding.ticker},
            )
            create_notification_event(
                db,
                holding.user_id,
                NotificationType.agent,
                f"{holding.ticker}: hold",
                "Monitoring cycle completed. AI suggests hold with no action required.",
                {"decision_id": str(decision.id), "ticker": holding.ticker},
            )
        else:
            tx_type = "BUY" if analysis["decision_type"] == "buy_more" else "SELL"
            order = Order(
                decision_id=decision.id,
                order_type=analysis["decision_type"],
                status=OrderStatus.pending,
                price=holding.entry_price,
                quantity=max(1, abs(int(analysis.get("quantity_delta", 1)))),
                transaction_type=tx_type,
            )
            db.add(order)
            log_event(
                db,
                agent.id,
                "decision_pending_confirmation",
                {
                    "decision_id": str(decision.id),
                    "order_type": analysis["decision_type"],
                    "quantity": order.quantity,
                    "deadline": decision.confirmation_deadline.isoformat() if decision.confirmation_deadline else None,
                },
            )
            create_notification_event(
                db,
                holding.user_id,
                NotificationType.agent,
                f"{holding.ticker}: action suggested",
                f"AI suggested {analysis['decision_type']} for your monitored position.",
                {"decision_id": str(decision.id), "decision_type": analysis["decision_type"], "ticker": holding.ticker},
            )

            if should_auto_execute(agent.agent_config):
                celery_app.send_task("backend.app.agents.monitor_task.auto_execute_expired_confirmations")

        db.commit()


async def _auto_execute_due_confirmations() -> int:
    now = datetime.now(tz=timezone.utc)
    executed = 0
    with SessionLocal() as db:
        pending_stmt = (
            select(AgentDecision)
            .join(MonitorAgent, AgentDecision.agent_id == MonitorAgent.id)
            .where(
                AgentDecision.confirmation_status == ConfirmationStatus.pending,
                AgentDecision.confirmation_deadline.is_not(None),
                AgentDecision.confirmation_deadline <= now,
            )
        )
        pending_decisions = db.execute(pending_stmt).scalars().all()
        for decision in pending_decisions:
            agent = db.get(MonitorAgent, decision.agent_id)
            if not agent:
                continue
            holding = db.get(StockHolding, agent.holding_id)
            if not holding:
                continue
            order = db.execute(select(Order).where(Order.decision_id == decision.id)).scalar_one_or_none()
            if not order:
                continue

            connection = db.execute(select(BrokerConnection).where(BrokerConnection.user_id == holding.user_id)).scalar_one_or_none()
            if connection:
                broker = get_broker(connection.broker_name)
                transaction_type = "BUY" if decision.decision_type == DecisionType.buy_more else "SELL"
                if order.transaction_type is None:
                    order.transaction_type = transaction_type
                request = OrderRequest(
                    ticker=holding.ticker,
                    exchange=holding.exchange,
                    transaction_type=transaction_type,
                    quantity=order.quantity,
                    order_type="MARKET",
                    price=order.price,
                )
                try:
                    _, token = await get_valid_broker_token_for_user(db=db, user_id=holding.user_id, broker=broker)
                    result = await broker.place_order(token, request)
                    order.broker_order_id = result.order_id
                    order.status = OrderStatus.placed
                    try:
                        live = await broker.get_order_status(result.order_id, token)
                        sync_order_from_broker_status(order, live)
                    except Exception:
                        pass
                except BrokerConfigurationError:
                    order.status = OrderStatus.failed
                except Exception:  # noqa: BLE001
                    order.status = OrderStatus.failed
            else:
                order.status = OrderStatus.failed

            decision.confirmation_status = ConfirmationStatus.auto_executed
            decision.confirmed_at = now
            log_event(
                db,
                decision.agent_id,
                "decision_auto_executed",
                {"decision_id": str(decision.id), "order_id": str(order.id), "status": order.status.value},
            )
            create_notification_event(
                db,
                holding.user_id,
                NotificationType.agent,
                f"{holding.ticker}: auto-executed",
                f"Decision was auto-executed and order status is {order.status.value}.",
                {"decision_id": str(decision.id), "order_id": str(order.id), "status": order.status.value},
            )
            executed += 1

        db.commit()
    return executed


@celery_app.task(name="backend.app.agents.monitor_task.run_monitoring_cycle")
def run_monitoring_cycle(agent_id: str) -> None:
    asyncio.run(_run_monitoring(agent_id))


@celery_app.task(name="backend.app.agents.monitor_task.auto_execute_expired_confirmations")
def auto_execute_expired_confirmations() -> int:
    return asyncio.run(_auto_execute_due_confirmations())

