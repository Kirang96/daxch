from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.middleware.auth import get_current_user
from backend.app.models.entities import AgentDecision, MonitorAgent, StockHolding, User
from backend.app.schemas.research import ResearchSnapshotResponse
from backend.app.services.ai.analyst import AIConfigurationError
from backend.app.services.ai.user_model import get_resolved_ai_model
from backend.app.services.ai_units.charging import check_analysis_quota, record_analysis_usage
from backend.app.services.analysis.pipeline import AnalysisPipeline
from backend.app.services.analysis.registry import StrategyAccessError, StrategyRegistry
from backend.app.services.broker.factory import get_broker
from backend.app.services.broker.session import get_valid_broker_token
from backend.app.services.broker.base import BrokerConfigurationError
from backend.app.services.broker.connection import require_user_broker
from backend.app.services.plan_limits import get_max_polling_frequency

router = APIRouter(prefix="/research", tags=["research"])


@router.get("/{ticker}", response_model=ResearchSnapshotResponse)
async def research_snapshot(
    ticker: str,
    strategy: str,
    intention: str = "long_term",
    capital: float | None = None,
    quantity: int | None = None,
    entry_price: float | None = None,
    exchange: str = "NSE",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ResearchSnapshotResponse:
    try:
        StrategyRegistry.assert_access(strategy, current_user.plan_tier.value)
    except StrategyAccessError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc

    check_analysis_quota(db, current_user)

    connection, broker = require_user_broker(db, current_user.id)
    _, token = await get_valid_broker_token(db=db, user=current_user, broker=broker)
    try:
        quote = await broker.get_quote(ticker=ticker.upper(), exchange=exchange, access_token=token)
    except BrokerConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    pipeline = AnalysisPipeline()
    max_freq = get_max_polling_frequency(current_user.plan_tier.value)
    ai_model = get_resolved_ai_model(db, current_user)
    try:
        analysis = await pipeline.run(
            strategy_id=strategy,
            ticker=ticker.upper(),
            exchange=exchange.upper(),
            broker=broker,
            access_token=token,
            intention=intention,
            quantity=quantity,
            capital=capital,
            planned_entry_price=entry_price,
            current_price=quote.ltp,
            max_adoptable_frequency=max_freq,
            ai_model=ai_model,
        )
    except AIConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    record_analysis_usage(db, current_user, analysis, operation_type="research")
    db.commit()

    stmt = (
        select(AgentDecision)
        .join(MonitorAgent, AgentDecision.agent_id == MonitorAgent.id)
        .join(StockHolding, MonitorAgent.holding_id == StockHolding.id)
        .where(
            StockHolding.user_id == current_user.id,
            StockHolding.ticker == ticker.upper(),
            StockHolding.exchange == exchange.upper(),
        )
        .order_by(AgentDecision.decided_at.desc())
        .limit(10)
    )
    recent = db.execute(stmt).scalars().all()
    recent_decisions = [
        {
            "decision_type": decision.decision_type.value,
            "confirmation_status": decision.confirmation_status.value,
            "reasoning": decision.reasoning,
            "decided_at": decision.decided_at.isoformat(),
        }
        for decision in recent
    ]

    return ResearchSnapshotResponse(
        ticker=quote.ticker,
        exchange=exchange.upper(),
        ltp=quote.ltp,
        change_percent=quote.change_percent,
        analysis=analysis,
        recent_decisions=recent_decisions,
    )
