from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.app.models.entities import User
from backend.app.services.ai_units.exceptions import AiQuotaExceededError
from backend.app.services.ai_units.pricing import compute_units
from backend.app.services.ai_units.service import AiUnitsService, UsageEventInput
from backend.app.services.analysis.schemas import StrategyAnalysisResult


def raise_quota_http(exc: AiQuotaExceededError) -> None:
    raise HTTPException(
        status_code=status.HTTP_402_PAYMENT_REQUIRED,
        detail={
            "code": "AI_UNITS_EXHAUSTED",
            "message": str(exc),
            "total_remaining": exc.total_remaining,
            "bonus_balance": exc.bonus_balance,
            "resets_at": exc.resets_at,
        },
    )


def check_analysis_quota(db: Session, user: User, min_units: int = 1) -> None:
    try:
        AiUnitsService.check_quota(db, user, min_units=min_units)
    except AiQuotaExceededError as exc:
        raise_quota_http(exc)


def record_analysis_usage(
    db: Session,
    user: User,
    result: StrategyAnalysisResult,
    *,
    operation_type: str = "analysis",
) -> int:
    metadata = result.metadata or {}
    model = str(metadata.get("model") or "gpt-4o-mini")
    prompt_tokens = int(metadata.get("prompt_tokens") or 0)
    completion_tokens = int(metadata.get("completion_tokens") or 0)
    tavily_credits = int(metadata.get("tavily_credits") or 0)
    units = compute_units(
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        model=model,
        tavily_credits=tavily_credits,
    )
    if units <= 0:
        return 0
    AiUnitsService.record_usage(
        db,
        user,
        UsageEventInput(
            operation_type=operation_type,
            model=model,
            units_charged=units,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            tavily_credits=tavily_credits,
            strategy_id=result.strategy,
            ticker=result.ticker,
        ),
    )
    return units
