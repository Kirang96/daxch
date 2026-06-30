import json
from typing import Any

from backend.app.core.config import get_settings
from backend.app.services.ai.analyst import AIConfigurationError
from backend.app.services.ai.openai_client import OpenAIUsage, complete_chat
from backend.app.services.ai.prompts import ANALYSIS_DISCLAIMER, MONITORING_PROMPT


class MonitoringService:
    def __init__(self) -> None:
        self.settings = get_settings()

    async def evaluate_position(
        self,
        ticker: str,
        intention: str,
        entry_price: float,
        quantity: int,
        market_snapshot: dict[str, Any],
        portfolio_snapshot: dict[str, Any],
        *,
        model: str | None = None,
    ) -> tuple[dict[str, Any], OpenAIUsage | None]:
        resolved_model = model or self.settings.openai_model
        if self.settings.openai_api_key:
            prompt = MONITORING_PROMPT.format(
                ticker=ticker,
                intention=intention,
                entry_price=entry_price,
                quantity=quantity,
                market_snapshot=market_snapshot,
                portfolio_snapshot=portfolio_snapshot,
            )
            try:
                content, usage = await complete_chat(
                    messages=[
                        {"role": "system", "content": "Return strict JSON only."},
                        {"role": "user", "content": prompt},
                    ],
                    model=resolved_model,
                    timeout=30,
                )
                parsed = json.loads(content)
                parsed["disclaimer"] = ANALYSIS_DISCLAIMER
                return parsed, usage
            except Exception as exc:
                if not self.settings.enable_demo_mode or self.settings.is_production:
                    raise exc

        if self.settings.is_production:
            raise AIConfigurationError("OPENAI_API_KEY is required in production.")
        if not self.settings.enable_demo_mode:
            raise AIConfigurationError("OPENAI_API_KEY is required when demo mode is disabled.")

        return {
            "decision_type": "hold",
            "confidence": 0.55,
            "reasoning": "Demo mode fallback: no OpenAI API key configured or API limits hit.",
            "quantity_delta": 0,
            "risk_flags": ["demo_mode"],
            "disclaimer": ANALYSIS_DISCLAIMER,
        }, None
