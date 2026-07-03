from backend.app.services.analysis.pipeline import AnalysisPipeline


def test_pipeline_context_includes_planned_entry(monkeypatch):
    captured: dict = {}

    class FakeStrategy:
        def build_prompt(self, context):
            captured.update(context)
            return "prompt"

        def required_data_types(self):
            return set()

    async def fake_complete(*args, **kwargs):
        from backend.app.services.analysis.schemas import LLMStrategyOutput

        return LLMStrategyOutput(
            decision_type="dont_enter",
            confidence=0.5,
            reasoning="test",
            quantity_delta=0,
            risk_flags=[],
        ), {}

    async def fake_eodhd_fetch(*args, **kwargs):
        return {
            "symbol": "RELIANCE.NSE",
            "api_calls": 0,
            "errors": [],
            "news_articles": [],
            "sentiment_trend": [],
            "upcoming_earnings": [],
            "price_context": {},
        }

    pipeline = AnalysisPipeline()
    monkeypatch.setattr("backend.app.services.analysis.registry.StrategyRegistry.get", lambda _: FakeStrategy())
    monkeypatch.setattr(pipeline.llm, "complete_strategy", fake_complete)
    monkeypatch.setattr(pipeline.market_fetcher, "fetch", lambda *a, **k: {"quote": None, "candles": []})
    monkeypatch.setattr(pipeline.eodhd_fetcher, "fetch", fake_eodhd_fetch)

    import asyncio

    asyncio.run(
        pipeline.run(
            strategy_id="technical_trend",
            ticker="RELIANCE",
            exchange="NSE",
            broker=object(),
            access_token="token",
            quantity=10,
            planned_entry_price=2500.0,
            current_price=2550.0,
        )
    )

    assert captured["planned_entry_price"] == 2500.0
    assert captured["planned_quantity"] == 10
    assert captured["current_price"] == 2550.0
