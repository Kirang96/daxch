import pytest

from backend.app.services.analysis.registry import StrategyAccessError, StrategyRegistry
from backend.app.services.analysis.schemas import StrategyId


def test_starter_can_access_technical_and_news():
    StrategyRegistry.assert_access(StrategyId.technical_trend.value, "starter")
    StrategyRegistry.assert_access(StrategyId.news_sentiment.value, "starter")


def test_starter_blocked_from_ai_trade_setup():
    with pytest.raises(StrategyAccessError):
        StrategyRegistry.assert_access(StrategyId.ai_trade_setup.value, "starter")


def test_pro_can_access_all_strategies():
    for sid in StrategyId:
        StrategyRegistry.assert_access(sid.value, "pro")


def test_list_for_plan_marks_availability():
    starter = StrategyRegistry.list_for_plan("starter")
    by_id = {s.id: s for s in starter}
    assert by_id["technical_trend"].available is True
    assert by_id["news_sentiment"].available is True
    assert by_id["ai_trade_setup"].available is False

    pro = StrategyRegistry.list_for_plan("pro")
    by_id_pro = {s.id: s for s in pro}
    assert all(s.available for s in by_id_pro.values())
