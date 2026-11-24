import hashlib


def selected_for_audit(pr_number: int, rate: float, salt: str) -> bool:
    """Deterministic sampling: re-running the gate on the same PR never changes the answer."""
    if rate <= 0:
        return False
    digest = hashlib.sha256(f"{salt}:{pr_number}".encode()).digest()
    return int.from_bytes(digest[:8], "big") / 2**64 < rate
