from dataclasses import dataclass


STARTER_MODEL = "gpt-4o-mini"
DEFAULT_PRO_MODEL = "gpt-4o-mini"


@dataclass(frozen=True)
class AiModelMeta:
    id: str
    label: str
    description: str
    ultra_only: bool = False


PRO_MODELS: tuple[AiModelMeta, ...] = (
    AiModelMeta("gpt-4o-mini", "GPT-4o Mini", "Fast and efficient for routine monitoring."),
    AiModelMeta("gpt-4o", "GPT-4o", "Balanced quality and speed for deeper analysis."),
    AiModelMeta("gpt-4.1-mini", "GPT-4.1 Mini", "Latest compact model with improved reasoning."),
    AiModelMeta("gpt-4.1", "GPT-4.1", "Highest quality for complex thesis evaluation."),
)

ULTRA_MODELS: tuple[AiModelMeta, ...] = (
    AiModelMeta("gpt-5.4-mini", "GPT-5.4 Mini", "Next-gen compact model with stronger reasoning.", ultra_only=True),
    AiModelMeta("gpt-5.4", "GPT-5.4", "Advanced analysis for demanding portfolios.", ultra_only=True),
    AiModelMeta("gpt-5.5", "GPT-5.5", "Top-tier model for maximum analysis depth.", ultra_only=True),
)

_PRO_MODEL_IDS = {model.id for model in PRO_MODELS}
_ULTRA_MODEL_IDS = {model.id for model in ULTRA_MODELS}
_ALL_PREMIUM_IDS = _PRO_MODEL_IDS | _ULTRA_MODEL_IDS


class AiModelAccessError(Exception):
    pass


def _is_premium_tier(plan_tier: str) -> bool:
    return plan_tier.lower() in {"pro", "ultra"}


def _is_ultra_tier(plan_tier: str) -> bool:
    return plan_tier.lower() == "ultra"


def list_models_for_plan(plan_tier: str) -> list[AiModelMeta]:
    if _is_ultra_tier(plan_tier):
        return list(PRO_MODELS) + list(ULTRA_MODELS)
    if _is_premium_tier(plan_tier):
        return list(PRO_MODELS)
    return [model for model in PRO_MODELS if model.id == STARTER_MODEL]


def can_change_model(plan_tier: str) -> bool:
    return _is_premium_tier(plan_tier)


def resolve_model(plan_tier: str, preferred: str | None) -> str:
    if not _is_premium_tier(plan_tier):
        return STARTER_MODEL
    allowed = _ALL_PREMIUM_IDS if _is_ultra_tier(plan_tier) else _PRO_MODEL_IDS
    if preferred and preferred in allowed:
        return preferred
    return DEFAULT_PRO_MODEL


def assert_model_allowed(plan_tier: str, model_id: str) -> None:
    if not can_change_model(plan_tier):
        raise AiModelAccessError("Model selection is available on Pro and Ultra plans.")
    allowed = _ALL_PREMIUM_IDS if _is_ultra_tier(plan_tier) else _PRO_MODEL_IDS
    if model_id not in allowed:
        raise AiModelAccessError(f"Model '{model_id}' is not available on your plan.")
