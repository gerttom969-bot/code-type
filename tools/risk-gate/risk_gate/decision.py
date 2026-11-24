from dataclasses import dataclass
from typing import Literal

from risk_gate.audit import selected_for_audit
from risk_gate.gitutil import FileChange
from risk_gate.rules import Policy, find_hits
from risk_gate.score import Score, score_pr

Verdict = Literal["cleared", "human_required", "blocked"]

# Speed bump, not security: you add this label AFTER reading the diff.
# The workflow strips it on every new push, so it only ever vouches for the diff you read.
OVERRIDE_LABEL = "critical-reviewed"


@dataclass(frozen=True)
class Decision:
    verdict: Verdict
    reasons: tuple[str, ...]
    score: Score
    audit_selected: bool
    overridden: bool

    @property
    def exit_code(self) -> int:
        if self.verdict == "blocked":
            return 2
        if self.verdict == "human_required" and not self.overridden:
            return 1
        return 0


def decide(
    *,
    changes: list[FileChange],
    policy: Policy,
    removed_content_ids: list[str],
    labels: frozenset[str],
    pr_number: int,
    audit_salt: str,
) -> Decision:
    reasons: list[str] = []
    needs_human = False
    blocked = False

    # Step 1: fixed rules.
    for hit in find_hits(policy.one_way_door, [c.path for c in changes]):
        needs_human = True
        reasons.append(f"one-way door `{hit.path}`: {hit.rule.reason}")

    if removed_content_ids:
        blocked = True
        reasons.append("content ids removed: " + ", ".join(removed_content_ids))

    # Step 2: risk score / out of distribution.
    score = score_pr(changes, policy)
    if score.out_of_distribution:
        needs_human = True
        reasons.append("out of distribution: " + "; ".join(score.ood_reasons))
    elif score.value >= policy.threshold:
        needs_human = True
        reasons.append(f"risk score {score.value:.2f} >= threshold {policy.threshold:.2f}")

    verdict: Verdict = "blocked" if blocked else "human_required" if needs_human else "cleared"
    overridden = verdict == "human_required" and OVERRIDE_LABEL in labels
    audit = verdict == "cleared" and selected_for_audit(pr_number, policy.audit_rate, audit_salt)
    return Decision(
        verdict=verdict,
        reasons=tuple(reasons),
        score=score,
        audit_selected=audit,
        overridden=overridden,
    )
