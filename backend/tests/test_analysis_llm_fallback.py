import asyncio
from unittest.mock import AsyncMock, patch

from backend.app.services.analysis.llm_client import LLMJsonClient, _extract_json
from backend.app.services.analysis.schemas import LLMStrategyOutput
from backend.app.services.analysis.strategies.technical_trend import TechnicalTrendStrategy


def test_extract_json_strips_markdown_fence():
    raw = '```json\n{"decision_type": "dont_enter", "confidence": 0.5, "reasoning": "x", "quantity_delta": 0, "risk_flags": []}\n```'
    parsed = _extract_json(raw)
    assert parsed["decision_type"] == "dont_enter"


def test_llm_strategy_output_normalizes_decision():
    out = LLMStrategyOutput.model_validate(
        {
            "decision_type": "BUY",
            "confidence": 1.5,
            "reasoning": "test",
            "quantity_delta": "2",
            "risk_flags": "OVERBOUGHT",
        }
    )
    assert out.decision_type == "enter"
    assert out.confidence == 1.0
    assert out.quantity_delta == 2
    assert out.risk_flags == ["OVERBOUGHT"]


def test_llm_client_falls_back_on_invalid_json():
    strategy = TechnicalTrendStrategy()
    client = LLMJsonClient()

    bad_response = {
        "choices": [{"message": {"content": "not json at all"}}]
    }

    async def run() -> tuple:
        with patch.object(client, "settings") as mock_settings:
            mock_settings.openai_api_key = "test-key"
            mock_settings.openai_model = "gpt-4o-mini"
            mock_settings.enable_demo_mode = True
            mock_settings.is_production = False

            with patch("httpx.AsyncClient") as mock_client_cls:
                mock_client = AsyncMock()
                mock_client_cls.return_value.__aenter__.return_value = mock_client
                mock_client.post.return_value.json.return_value = bad_response
                mock_client.post.return_value.raise_for_status = lambda: None

                return await client.complete_strategy(
                    strategy, ticker="RELIANCE", prompt="test"
                )

    output, meta = asyncio.run(run())

    assert meta["parse_failed"] is True
    assert output.decision_type == "dont_enter"
    assert "LLM_PARSE_FAILED" in output.risk_flags
