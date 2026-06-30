from dataclasses import dataclass


STARTER_MODEL = "gpt-4o-mini"
DEFAULT_PRO_MODEL = "gpt-4o-mini"


@dataclass(frozen=True)
class AiModelMeta:
    id: str
    label: str
    description: str


PRO_MODELS: tuple[AiModelMeta, ...] = (
    AiModelMeta("gpt-4o-mini", "GPT-4o Mini", "Fast and efficient for routine monitoring."),
    AiModelMeta("gpt-4o", "GPT-4o", "Balanced quality and speed for deeper analysis."),
    AiModelMeta("gpt-4.1-mini", "GPT-4.1 Mini", "Latest compact model with improved reasoning."),
    AiModelMeta("gpt-4.1", "GPT-4.1", "Highest quality for complex thesis evaluation."),
)

_PRO_MODEL_IDS = {model.id for model in PRO_MODELS}


class AiModelAccessError(Exception):
    pass


def _is_premium_tier(plan_tier: str) -> bool:
    return plan_tier.lower() in {"pro", "ultra"}


def list_models_for_plan(plan_tier: str) -> list[AiModelMeta]:
    if _is_premium_tier(plan_tier):
        return list(PRO_MODELS)
    return [model for model in PRO_MODELS if model.id == STARTER_MODEL]


def can_change_model(plan_tier: str) -> bool:
    return _is_premium_tier(plan_tier)


def resolve_model(plan_tier: str, preferred: str | None) -> str:
    if not _is_premium_tier(plan_tier):
        return STARTER_MODEL
    if preferred and preferred in _PRO_MODEL_IDS:
        return preferred
    return DEFAULT_PRO_MODEL


def assert_model_allowed(plan_tier: str, model_id: str) -> None:
    if not can_change_model(plan_tier):
        raise AiModelAccessError("Model selection is available on Pro and Ultra plans.")
    if model_id not in _PRO_MODEL_IDS:
        raise AiModelAccessError(f"Model '{model_id}' is not available.")
