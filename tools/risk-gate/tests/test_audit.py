from risk_gate.audit import selected_for_audit


def test_is_deterministic() -> None:
    assert selected_for_audit(42, 0.1, "s") == selected_for_audit(42, 0.1, "s")


def test_rate_zero_never_selects() -> None:
    assert not any(selected_for_audit(n, 0.0, "s") for n in range(1000))


def test_rate_is_roughly_respected() -> None:
    picked = sum(selected_for_audit(n, 0.1, "s") for n in range(10_000))
    assert 800 < picked < 1200
