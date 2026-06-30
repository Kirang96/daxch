from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.middleware.auth import get_current_user
from backend.app.models.entities import User
from backend.app.schemas.analysis import StrategyAnalysisResponse, StrategyListResponse
from backend.app.services.ai.analyst import AIConfigurationError
from backend.app.services.ai.user_model import get_resolved_ai_model
from backend.app.services.ai_units.charging import check_analysis_quota, record_analysis_usage
from backend.app.services.analysis.pipeline import AnalysisPipeline
from backend.app.services.analysis.registry import StrategyAccessError, StrategyRegistry
from backend.app.services.broker.factory import get_broker
from backend.app.services.broker.session import get_valid_broker_token
from backend.app.services.broker.upstox import BrokerConfigurationError
from backend.app.services.plan_limits import get_max_polling_frequency

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.get("/strategies", response_model=StrategyListResponse)
def list_strategies(
    current_user: User = Depends(get_current_user),
) -> StrategyListResponse:
    strategies = StrategyRegistry.list_for_plan(current_user.plan_tier.value)
    return StrategyListResponse(
        plan=current_user.plan_tier.value,
        strategies=strategies,
    )


@router.post("/{ticker}", response_model=StrategyAnalysisResponse)
async def run_analysis(
    ticker: str,
    strategy: str,
    exchange: str = "NSE",
    intention: str = "long_term",
    quantity: int | None = None,
    capital: float | None = None,
    entry_price: float | None = None,
    polling_frequency: int = 2,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StrategyAnalysisResponse:
    try:
        StrategyRegistry.assert_access(strategy, current_user.plan_tier.value)
    except StrategyAccessError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc

    check_analysis_quota(db, current_user)

    broker = get_broker("upstox")
    _, token = await get_valid_broker_token(db=db, user=current_user, broker=broker)

    pipeline = AnalysisPipeline()
    max_freq = get_max_polling_frequency(current_user.plan_tier.value)
    ai_model = get_resolved_ai_model(db, current_user)
    try:
        result = await pipeline.run(
            strategy_id=strategy,
            ticker=ticker.upper(),
            exchange=exchange.upper(),
            broker=broker,
            access_token=token,
            intention=intention,
            quantity=quantity,
            capital=capital,
            planned_entry_price=entry_price,
            user_polling_frequency=polling_frequency,
            max_adoptable_frequency=max_freq,
            ai_model=ai_model,
        )
    except AIConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except BrokerConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    record_analysis_usage(db, current_user, result, operation_type="analysis")
    db.commit()

    return StrategyAnalysisResponse(
        ticker=ticker.upper(),
        exchange=exchange.upper(),
        analysis=result,
    )
