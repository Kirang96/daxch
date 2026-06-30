import json
import re
from typing import Any

from pydantic import ValidationError

from backend.app.core.config import get_settings
from backend.app.services.ai.analyst import AIConfigurationError
from backend.app.services.ai.openai_client import complete_chat
from backend.app.services.analysis.schemas import LLMStrategyOutput
from backend.app.services.analysis.strategies.base import AnalysisStrategy


def _extract_json(content: str) -> dict[str, Any]:
    content = content.strip()
    if content.startswith("```"):
        content = re.sub(r"^```(?:json)?\s*", "", content)
        content = re.sub(r"\s*```$", "", content)
    return json.loads(content)


class LLMJsonClient:
    def __init__(self) -> None:
        self.settings = get_settings()

    async def complete_strategy(
        self,
        strategy: AnalysisStrategy,
        *,
        ticker: str,
        prompt: str,
        model: str | None = None,
    ) -> tuple[LLMStrategyOutput, dict[str, Any]]:
        metadata: dict[str, Any] = {
            "parse_failed": False,
            "retries": 0,
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "model": model or self.settings.openai_model,
        }

        if not self.settings.openai_api_key:
            if self.settings.is_production:
                raise AIConfigurationError("OPENAI_API_KEY is required in production.")
            if not self.settings.enable_demo_mode:
                raise AIConfigurationError("OPENAI_API_KEY is required when demo mode is disabled.")
            metadata["parse_failed"] = True
            metadata["demo_mode"] = True
            return strategy.safe_fallback(ticker, "Demo mode without OpenAI."), metadata

        last_error = ""
        resolved_model = model or self.settings.openai_model
        for attempt in range(2):
            system = "Respond only in strict JSON with the required keys."
            if attempt > 0:
                system = f"Your previous response was invalid: {last_error}. Return valid strict JSON only."
                metadata["retries"] = attempt

            try:
                output, usage = await self._call_openai(system, prompt, model=resolved_model)
                metadata["prompt_tokens"] = usage.prompt_tokens
                metadata["completion_tokens"] = usage.completion_tokens
                metadata["model"] = resolved_model
                return output, metadata
            except (json.JSONDecodeError, ValidationError, KeyError, IndexError) as exc:
                last_error = str(exc)
                metadata["last_error"] = last_error
            except Exception as exc:
                if not self.settings.enable_demo_mode or self.settings.is_production:
                    raise
                last_error = str(exc)
                metadata["last_error"] = last_error
                break

        metadata["parse_failed"] = True
        fallback = strategy.safe_fallback(ticker, last_error)
        if "LLM_PARSE_FAILED" not in fallback.risk_flags:
            fallback.risk_flags.append("LLM_PARSE_FAILED")
        return fallback, metadata

    async def _call_openai(self, system: str, prompt: str, *, model: str) -> tuple[LLMStrategyOutput, Any]:
        content, usage = await complete_chat(
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            model=model,
            response_format={"type": "json_object"},
        )
        parsed = _extract_json(content)
        return LLMStrategyOutput.model_validate(parsed), usage
