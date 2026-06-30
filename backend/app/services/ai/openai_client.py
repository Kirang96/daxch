from __future__ import annotations

from typing import Any

import httpx

from backend.app.core.config import get_settings


class OpenAIUsage:
    def __init__(self, prompt_tokens: int, completion_tokens: int) -> None:
        self.prompt_tokens = prompt_tokens
        self.completion_tokens = completion_tokens


async def complete_chat(
    *,
    messages: list[dict[str, str]],
    model: str,
    temperature: float = 0.1,
    response_format: dict[str, str] | None = None,
    timeout: float = 45,
) -> tuple[str, OpenAIUsage]:
    settings = get_settings()
    headers = {"Authorization": f"Bearer {settings.openai_api_key}"}
    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
    }
    if response_format:
        payload["response_format"] = response_format

    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            "https://api.openai.com/v1/chat/completions",
            json=payload,
            headers=headers,
        )
        response.raise_for_status()
        data = response.json()

    usage_raw = data.get("usage") or {}
    usage = OpenAIUsage(
        prompt_tokens=int(usage_raw.get("prompt_tokens", 0)),
        completion_tokens=int(usage_raw.get("completion_tokens", 0)),
    )
    content = data["choices"][0]["message"]["content"]
    return content, usage
