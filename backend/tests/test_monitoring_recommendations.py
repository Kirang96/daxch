from backend.app.services.analysis.monitoring_recommendations import suggest_entry, suggest_polling_frequency


def test_suggest_entry_enter_near_support():
    entry, signal = suggest_entry(
        100.0,
        "enter",
        {"support_resistance": {"support": 95.0, "resistance": 110.0}},
        [],
    )
    assert entry == 95.0
    assert signal == "buy_near_support"


def test_suggest_polling_frequency_respects_intention():
    freq, rationale, factors = suggest_polling_frequency(
        "swing",
        {"bollinger": {"bandwidth": 8}},
        user_polling_frequency=2,
        decision_type="dont_enter",
        risk_flags=[],
    )
    assert 2 <= freq <= 12
    assert rationale
    assert factors
