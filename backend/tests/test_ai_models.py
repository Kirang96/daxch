import pytest

from backend.app.services.ai.models import (
    AiModelAccessError,
    STARTER_MODEL,
    assert_model_allowed,
    can_change_model,
    list_models_for_plan,
    resolve_model,
)


def test_starter_always_uses_small_model() -> None:
    assert resolve_model("starter", None) == STARTER_MODEL
    assert resolve_model("starter", "gpt-4o") == STARTER_MODEL
    assert not can_change_model("starter")
    assert len(list_models_for_plan("starter")) == 1
    assert list_models_for_plan("starter")[0].id == STARTER_MODEL


def test_pro_can_select_models() -> None:
    assert can_change_model("pro")
    assert len(list_models_for_plan("pro")) == 4
    assert resolve_model("pro", "gpt-4o") == "gpt-4o"
    assert resolve_model("pro", None) == STARTER_MODEL
    assert resolve_model("pro", "invalid-model") == STARTER_MODEL


def test_assert_model_allowed() -> None:
    with pytest.raises(AiModelAccessError):
        assert_model_allowed("starter", "gpt-4o")
    with pytest.raises(AiModelAccessError):
        assert_model_allowed("pro", "gpt-5")
    assert_model_allowed("pro", "gpt-4.1")


def test_ultra_same_as_pro_for_models() -> None:
    assert can_change_model("ultra")
    assert len(list_models_for_plan("ultra")) == 4
    assert resolve_model("ultra", "gpt-4.1") == "gpt-4.1"
    assert_model_allowed("ultra", "gpt-4.1")
