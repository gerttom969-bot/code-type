from dataclasses import replace
from pathlib import Path

from risk_gate.decision import OVERRIDE_LABEL, Decision, decide
from risk_gate.gitutil import FileChange
from risk_gate.rules import load_policy

POLICY = load_policy(Path(__file__).parents[3] / "risk" / "policy.yml")


def fc(path: str, added: int = 5, deleted: int = 0) -> FileChange:
    return FileChange(path=path, added=added, deleted=deleted, binary=False)


def run(
    changes: list[FileChange],
    labels: frozenset[str] = frozenset(),
    removed: list[str] | None = None,
    audit_rate: float | None = None,
) -> Decision:
    policy = POLICY if audit_rate is None else replace(POLICY, audit_rate=audit_rate)
    return decide(
        changes=changes,
        policy=policy,
        removed_content_ids=removed or [],
        labels=labels,
        pr_number=1,
        audit_salt="test",
    )


def test_small_ui_change_is_cleared() -> None:
    decision = run([fc("src/ui/dom.js", added=10)])
    assert decision.verdict == "cleared"
    assert decision.exit_code == 0


def test_docs_only_change_is_cleared() -> None:
    assert run([fc("README.md", added=30)]).verdict == "cleared"


def test_one_way_door_requires_human() -> None:
    decision = run([fc("src/security/password-kdf.js")])
    assert decision.verdict == "human_required"
    assert decision.exit_code == 1


def test_every_existing_one_way_door_is_enforced() -> None:
    for path in (
        "src/services/auth-service.js",
        "src/domain/progress.js",
        "src/infrastructure/pyodide-runner.js",
        "SECURITY.md",
        ".github/workflows/ci.yml",
        "risk/policy.yml",
        "tools/risk-gate/risk_gate/decision.py",
    ):
        assert run([fc(path)]).verdict == "human_required", path


def test_override_label_passes_human_required() -> None:
    decision = run([fc("src/security/password-kdf.js")], labels=frozenset({OVERRIDE_LABEL}))
    assert decision.overridden
    assert decision.exit_code == 0


def test_removed_content_id_is_blocked_even_with_label() -> None:
    decision = run(
        [fc("content/problems/two-sum/problem.json")],
        labels=frozenset({OVERRIDE_LABEL}),
        removed=["two-sum"],
    )
    assert decision.verdict == "blocked"
    assert decision.exit_code == 2


def test_huge_diff_is_out_of_distribution() -> None:
    decision = run([fc("src/ui/learning-studio.js", added=2000)])
    assert decision.verdict == "human_required"
    assert decision.score.out_of_distribution


def test_elevated_file_alone_does_not_force_review() -> None:
    decision = run([fc("package.json", added=3)])
    assert decision.verdict == "cleared"
    assert decision.score.elevated_files == 1


def test_elevated_file_plus_large_diff_trips_the_score() -> None:
    decision = run([fc("src/ui/learning-studio.js", added=395), fc("package.json", added=5)])
    assert decision.verdict == "human_required"
    assert not decision.score.out_of_distribution
    assert any("risk score" in reason for reason in decision.reasons)


def test_only_cleared_prs_are_audited() -> None:
    cleared = run([fc("src/ui/dom.js")], audit_rate=1.0)
    human = run([fc("src/security/safe-html.js")], audit_rate=1.0)
    assert cleared.audit_selected
    assert not human.audit_selected
