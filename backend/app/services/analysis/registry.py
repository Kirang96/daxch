from backend.app.services.analysis.schemas import StrategyId, StrategyMeta
from backend.app.services.analysis.strategies.ai_trade_setup import AITradeSetupStrategy
from backend.app.services.analysis.strategies.base import AnalysisStrategy
from backend.app.services.analysis.strategies.news_sentiment import NewsSentimentStrategy
from backend.app.services.analysis.strategies.technical_trend import TechnicalTrendStrategy

PLAN_STRATEGIES: dict[str, set[str]] = {
    "starter": {StrategyId.technical_trend.value, StrategyId.news_sentiment.value},
    "pro": {
        StrategyId.technical_trend.value,
        StrategyId.news_sentiment.value,
        StrategyId.ai_trade_setup.value,
    },
    "ultra": {
        StrategyId.technical_trend.value,
        StrategyId.news_sentiment.value,
        StrategyId.ai_trade_setup.value,
    },
}

_STRATEGIES: dict[str, AnalysisStrategy] = {
    StrategyId.technical_trend.value: TechnicalTrendStrategy(),
    StrategyId.news_sentiment.value: NewsSentimentStrategy(),
    StrategyId.ai_trade_setup.value: AITradeSetupStrategy(),
}


class StrategyAccessError(PermissionError):
    pass


class StrategyRegistry:
    @staticmethod
    def get(strategy_id: str) -> AnalysisStrategy:
        if strategy_id not in _STRATEGIES:
            raise ValueError(f"Unknown strategy: {strategy_id}")
        return _STRATEGIES[strategy_id]

    @staticmethod
    def list_for_plan(plan_tier: str) -> list[StrategyMeta]:
        tier = plan_tier.lower()
        allowed = PLAN_STRATEGIES.get(tier, PLAN_STRATEGIES["starter"])
        result: list[StrategyMeta] = []
        for sid, strategy in _STRATEGIES.items():
            result.append(
                StrategyMeta(
                    id=sid,
                    name=strategy.name,
                    description=strategy.description,
                    min_plan=strategy.min_plan,  # type: ignore[arg-type]
                    available=sid in allowed,
                )
            )
        return result

    @staticmethod
    def assert_access(strategy_id: str, plan_tier: str) -> None:
        tier = plan_tier.lower()
        allowed = PLAN_STRATEGIES.get(tier, PLAN_STRATEGIES["starter"])
        if strategy_id not in allowed:
            raise StrategyAccessError(
                f"Strategy '{strategy_id}' requires a Pro or Ultra subscription."
            )
