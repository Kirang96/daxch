from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.models.entities import (
    AiUnitTopupPurchase,
    AiUsageEvent,
    NotificationType,
    User,
    UserAiBonusBalance,
    UserAiUsageSummary,
)
from backend.app.services.ai_units.exceptions import AiQuotaExceededError
from backend.app.services.ai_units.period import resolve_billing_period
from backend.app.services.ai_units.pricing import estimate_monitoring_units_per_poll, estimate_portfolio_monthly_units
from backend.app.services.notification_events import create_notification_event
from backend.app.services.plan_limits import get_monthly_ai_units


@dataclass
class UsageEventInput:
    operation_type: str
    model: str
    units_charged: int
    prompt_tokens: int = 0
    completion_tokens: int = 0
    tavily_credits: int = 0
    strategy_id: str | None = None
    agent_id: UUID | None = None
    ticker: str | None = None


@dataclass
class QuotaSnapshot:
    plan_allowance: int
    plan_remaining: int
    plan_consumed: int
    bonus_balance: int
    total_remaining: int
    total_used: int
    total_limit: int
    percent_used: float
    period_start: datetime
    period_end: datetime
    has_active_subscription: bool


class AiUnitsService:
    @staticmethod
    def _get_or_create_bonus(db: Session, user_id: UUID) -> UserAiBonusBalance:
        row = db.get(UserAiBonusBalance, user_id)
        if row is None:
            row = UserAiBonusBalance(user_id=user_id, balance=0)
            db.add(row)
            db.flush()
        return row

    @staticmethod
    def _get_or_create_summary(db: Session, user_id: UUID, period_start: datetime, period_end: datetime) -> UserAiUsageSummary:
        stmt = select(UserAiUsageSummary).where(
            UserAiUsageSummary.user_id == user_id,
            UserAiUsageSummary.period_start == period_start,
        )
        row = db.execute(stmt).scalar_one_or_none()
        if row is None:
            row = UserAiUsageSummary(
                user_id=user_id,
                period_start=period_start,
                period_end=period_end,
                units_consumed_from_plan=0,
            )
            db.add(row)
            db.flush()
        return row

    @classmethod
    def get_quota(cls, db: Session, user: User) -> QuotaSnapshot:
        period = resolve_billing_period(db, user)
        plan_allowance = get_monthly_ai_units(user.plan_tier.value)
        summary = cls._get_or_create_summary(db, user.id, period.period_start, period.period_end)
        bonus = cls._get_or_create_bonus(db, user.id)
        plan_consumed = summary.units_consumed_from_plan
        plan_remaining = max(0, plan_allowance - plan_consumed)
        bonus_balance = bonus.balance
        total_remaining = plan_remaining + bonus_balance
        total_limit = plan_allowance + bonus_balance
        total_used = plan_consumed + max(0, cls._bonus_consumed_estimate(plan_allowance, plan_consumed, bonus_balance))
        # total_used for display: plan consumed + (initial bonus at period - current bonus) is hard without tracking;
        # use plan_consumed + max(0, total_limit - total_remaining) simplified:
        total_used_display = total_limit - total_remaining
        percent_used = (total_used_display / total_limit * 100.0) if total_limit > 0 else 0.0
        from backend.app.services.subscription_access import get_latest_subscription, has_platform_access

        sub = get_latest_subscription(db, user.id)
        has_sub = bool(sub and has_platform_access(sub))
        return QuotaSnapshot(
            plan_allowance=plan_allowance,
            plan_remaining=plan_remaining,
            plan_consumed=plan_consumed,
            bonus_balance=bonus_balance,
            total_remaining=total_remaining,
            total_used=total_used_display,
            total_limit=total_limit,
            percent_used=min(100.0, float(round(percent_used))),
            period_start=period.period_start,
            period_end=period.period_end,
            has_active_subscription=has_sub,
        )

    @staticmethod
    def _bonus_consumed_estimate(plan_allowance: int, plan_consumed: int, bonus_balance: int) -> int:
        return 0

    @classmethod
    def check_quota(cls, db: Session, user: User, min_units: int = 0) -> QuotaSnapshot:
        quota = cls.get_quota(db, user)
        if quota.total_remaining < min_units:
            raise AiQuotaExceededError(
                total_remaining=quota.total_remaining,
                bonus_balance=quota.bonus_balance,
                resets_at=quota.period_end.isoformat(),
            )
        return quota

    @classmethod
    def record_usage(cls, db: Session, user: User, event: UsageEventInput) -> None:
        if event.units_charged <= 0:
            return
        period = resolve_billing_period(db, user)
        summary = cls._get_or_create_summary(db, user.id, period.period_start, period.period_end)
        bonus = cls._get_or_create_bonus(db, user.id)
        plan_allowance = get_monthly_ai_units(user.plan_tier.value)
        remaining_plan = max(0, plan_allowance - summary.units_consumed_from_plan)
        from_plan = min(remaining_plan, event.units_charged)
        from_bonus = event.units_charged - from_plan
        summary.units_consumed_from_plan += from_plan
        if from_bonus > 0:
            bonus.balance = max(0, bonus.balance - from_bonus)
            bonus.updated_at = datetime.now(tz=timezone.utc)
        db.add(
            AiUsageEvent(
                user_id=user.id,
                period_start=period.period_start,
                period_end=period.period_end,
                operation_type=event.operation_type,
                model=event.model,
                strategy_id=event.strategy_id,
                agent_id=event.agent_id,
                ticker=event.ticker,
                prompt_tokens=event.prompt_tokens,
                completion_tokens=event.completion_tokens,
                tavily_credits=event.tavily_credits,
                units_charged=event.units_charged,
            )
        )
        cls._maybe_warn_usage(db, user, summary, bonus, plan_allowance)

    @classmethod
    def _maybe_warn_usage(
        cls,
        db: Session,
        user: User,
        summary: UserAiUsageSummary,
        bonus: UserAiBonusBalance,
        plan_allowance: int,
    ) -> None:
        plan_remaining = max(0, plan_allowance - summary.units_consumed_from_plan)
        total_remaining = plan_remaining + bonus.balance
        total_limit = plan_allowance + bonus.balance
        if total_limit <= 0:
            return
        used_pct = (total_limit - total_remaining) / total_limit * 100.0
        thresholds = (80, 95)
        warned = set((summary.warning_thresholds_sent or {}).get("thresholds", []))
        for threshold in thresholds:
            if used_pct >= threshold and threshold not in warned:
                warned.add(threshold)
                create_notification_event(
                    db,
                    user.id,
                    NotificationType.system,
                    f"AI Units {threshold}% used",
                    f"You've used {threshold}% of your AI Units. Buy more on the Subscription page if needed.",
                    {"threshold": threshold, "percent_used": round(used_pct, 1)},
                )
        if not summary.warning_thresholds_sent:
            summary.warning_thresholds_sent = {}
        summary.warning_thresholds_sent = {**summary.warning_thresholds_sent, "thresholds": sorted(warned)}

    @classmethod
    def credit_bonus(cls, db: Session, user_id: UUID, units: int, purchase_id: UUID) -> None:
        purchase = db.get(AiUnitTopupPurchase, purchase_id)
        if purchase is None or purchase.status == "paid":
            return
        bonus = cls._get_or_create_bonus(db, user_id)
        bonus.balance += units
        bonus.updated_at = datetime.now(tz=timezone.utc)
        purchase.status = "paid"
        purchase.paid_at = datetime.now(tz=timezone.utc)

    @classmethod
    def estimate_monitoring_units_per_poll(cls, model: str) -> int:
        return estimate_monitoring_units_per_poll(model)

    @classmethod
    def estimate_portfolio_monthly_units(cls, *, total_daily_polls: int, model: str) -> int:
        return estimate_portfolio_monthly_units(total_daily_polls=total_daily_polls, model=model)
