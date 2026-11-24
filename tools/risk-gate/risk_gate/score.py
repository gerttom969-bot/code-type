from dataclasses import dataclass

from risk_gate.gitutil import FileChange
from risk_gate.rules import Policy, find_hits


@dataclass(frozen=True)
class Score:
    value: float
    lines: int
    files: int
    elevated_files: int
    out_of_distribution: bool
    ood_reasons: tuple[str, ...]


def score_pr(changes: list[FileChange], policy: Policy) -> Score:
    """Step 2, v0: a transparent heuristic, not a trained model.
    TODO(question): a learned model needs hundreds of labelled PRs. Until then every PR's
    decision JSON (uploaded as a CI artifact) plus the audit-ok/audit-missed labels is the
    dataset. Keep this signature so a model can replace the body later."""
    lines = sum(c.added + c.deleted for c in changes)
    files = len(changes)
    elevated = len({hit.path for hit in find_hits(policy.elevated, [c.path for c in changes])})
    value = (
        0.5 * min(1.0, lines / 600)
        + 0.2 * min(1.0, files / 20)
        + 0.3 * min(1.0, elevated * 0.5)
    )

    reasons: list[str] = []
    if not changes:
        reasons.append("empty diff")
    if any(c.binary for c in changes):
        reasons.append("binary files")
    if lines > policy.ood_max_lines:
        reasons.append(f"{lines} changed lines > {policy.ood_max_lines}")
    if files > policy.ood_max_files:
        reasons.append(f"{files} files > {policy.ood_max_files}")

    return Score(
        value=round(value, 3),
        lines=lines,
        files=files,
        elevated_files=elevated,
        out_of_distribution=bool(reasons),
        ood_reasons=tuple(reasons),
    )
