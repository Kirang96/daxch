from dataclasses import dataclass
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.models.entities import AgentDecision, MonitorAgent, Order, StockHolding

FILLED_BROKER_STATUSES = frozenset({"complete", "filled", "trade_complete"})


@dataclass
class ExchangePosition:
    holding_id: UUID
    ticker: str
    exchange: str
    net_quantity: int
    average_cost: float
    invested: float
    market_value: float | None
    unrealized_pnl: float | None
    unrealized_pnl_pct: float | None
    has_exchange_position: bool

    def to_dict(self) -> dict[str, Any]:
        return {
            "holding_id": str(self.holding_id),
            "ticker": self.ticker,
            "exchange": self.exchange,
            "net_quantity": self.net_quantity,
            "average_cost": self.average_cost,
            "invested": self.invested,
            "market_value": self.market_value,
            "unrealized_pnl": self.unrealized_pnl,
            "unrealized_pnl_pct": self.unrealized_pnl_pct,
            "has_exchange_position": self.has_exchange_position,
        }


def _is_filled_order(order: Order) -> bool:
    if order.filled_quantity > 0 and order.average_price is not None:
        return True
    broker_status = (order.broker_status or "").lower()
    return broker_status in FILLED_BROKER_STATUSES and order.filled_quantity > 0


def aggregate_exchange_positions(
    db: Session,
    user_id: UUID,
    quotes: dict[str, float] | None = None,
) -> list[ExchangePosition]:
    """Compute net exchange positions from filled Daxch orders per holding."""
    quotes = quotes or {}
    holdings = db.execute(select(StockHolding).where(StockHolding.user_id == user_id)).scalars().all()
    results: list[ExchangePosition] = []

    for holding in holdings:
        stmt = (
            select(Order)
            .join(AgentDecision, Order.decision_id == AgentDecision.id)
            .join(MonitorAgent, AgentDecision.agent_id == MonitorAgent.id)
            .where(MonitorAgent.holding_id == holding.id)
            .order_by(Order.created_at.asc())
        )
        orders = db.execute(stmt).scalars().all()

        buy_qty = 0
        buy_cost = 0.0
        sell_qty = 0

        for order in orders:
            if not _is_filled_order(order):
                continue
            qty = order.filled_quantity
            price = order.average_price or order.price
            tx = (order.transaction_type or order.order_type or "").upper()
            if tx in ("BUY", "BUY_MORE"):
                buy_qty += qty
                buy_cost += qty * price
            elif tx in ("SELL",):
                sell_qty += qty

        net_qty = buy_qty - sell_qty
        if net_qty <= 0 or buy_qty <= 0:
            results.append(
                ExchangePosition(
                    holding_id=holding.id,
                    ticker=holding.ticker,
                    exchange=holding.exchange,
                    net_quantity=0,
                    average_cost=0.0,
                    invested=0.0,
                    market_value=None,
                    unrealized_pnl=None,
                    unrealized_pnl_pct=None,
                    has_exchange_position=False,
                )
            )
            continue

        # Weighted average cost for remaining shares (WAC after sells)
        remaining_buy_qty = max(net_qty, 0)
        avg_cost = buy_cost / buy_qty if buy_qty > 0 else 0.0
        invested = avg_cost * remaining_buy_qty

        quote_key = f"{holding.ticker}:{holding.exchange}"
        ltp = quotes.get(quote_key)
        market_value = ltp * remaining_buy_qty if ltp is not None else None
        unrealized_pnl = (market_value - invested) if market_value is not None else None
        unrealized_pnl_pct = (
            (unrealized_pnl / invested) * 100 if unrealized_pnl is not None and invested > 0 else None
        )

        results.append(
            ExchangePosition(
                holding_id=holding.id,
                ticker=holding.ticker,
                exchange=holding.exchange,
                net_quantity=remaining_buy_qty,
                average_cost=round(avg_cost, 2),
                invested=round(invested, 2),
                market_value=round(market_value, 2) if market_value is not None else None,
                unrealized_pnl=round(unrealized_pnl, 2) if unrealized_pnl is not None else None,
                unrealized_pnl_pct=round(unrealized_pnl_pct, 2) if unrealized_pnl_pct is not None else None,
                has_exchange_position=True,
            )
        )

    return results


def aggregate_portfolio_summary(positions: list[ExchangePosition]) -> dict[str, Any]:
    active = [p for p in positions if p.has_exchange_position]
    invested = sum(p.invested for p in active)
    market_value = sum(p.market_value or 0 for p in active)
    pnl = sum(p.unrealized_pnl or 0 for p in active)
    pnl_pct = (pnl / invested * 100) if invested > 0 else None
    return {
        "has_exchange_positions": len(active) > 0,
        "invested": round(invested, 2),
        "market_value": round(market_value, 2) if active else None,
        "unrealized_pnl": round(pnl, 2) if active else None,
        "unrealized_pnl_pct": round(pnl_pct, 2) if pnl_pct is not None else None,
        "position_count": len(active),
    }
