from risk_gate.decision import OVERRIDE_LABEL, Decision

_TITLE = {
    "cleared": "CLEARED",
    "human_required": "HUMAN REVIEW REQUIRED",
    "blocked": "BLOCKED",
}


def render(decision: Decision, pr_number: int) -> str:
    s = decision.score
    lines = [f"## Risk gate: PR #{pr_number} - {_TITLE[decision.verdict]}", ""]
    if decision.reasons:
        lines.append("**Reasons**")
        lines.extend(f"- {reason}" for reason in decision.reasons)
        lines.append("")
    lines.append(
        f"Score {s.value:.2f} | {s.lines} changed lines | {s.files} files | "
        f"{s.elevated_files} elevated files"
    )
    lines.append("")
    if decision.overridden:
        lines.append(f"Override: label `{OVERRIDE_LABEL}` is present (a human read the diff).")
    elif decision.verdict == "human_required":
        lines.append(f"Read the diff, then add the `{OVERRIDE_LABEL}` label to pass this check.")
    elif decision.verdict == "blocked":
        lines.append("Not overridable. Mark content as `deprecated` instead of removing it.")
    if decision.audit_selected:
        lines.append("Sampled for a post-merge audit: an issue will be opened on merge.")
    return "\n".join(lines) + "\n"
