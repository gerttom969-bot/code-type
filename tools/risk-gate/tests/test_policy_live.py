import subprocess
from pathlib import Path

import pytest

from risk_gate.rules import load_policy

REPO = Path(__file__).parents[3]


def _tracked_files() -> list[str]:
    proc = subprocess.run(
        ["git", "ls-files"], cwd=REPO, capture_output=True, text=True, check=False
    )
    if proc.returncode != 0:
        pytest.skip("not inside a git checkout (run `git init && git add .` first)")
    return proc.stdout.splitlines()


def test_every_non_planned_rule_matches_a_tracked_file() -> None:
    policy = load_policy(REPO / "risk" / "policy.yml")
    tracked = _tracked_files()
    dead = [
        rule.pattern
        for rule in (*policy.one_way_door, *policy.elevated)
        if not rule.planned and not any(rule.matches(path) for path in tracked)
    ]
    assert dead == []


def test_planned_rules_that_now_match_are_promoted() -> None:
    """A rule still marked `planned` after its path exists is not dead, but it hides the
    safety net from test_every_non_planned_rule_matches_a_tracked_file."""
    policy = load_policy(REPO / "risk" / "policy.yml")
    tracked = _tracked_files()
    stale = [
        rule.pattern
        for rule in (*policy.one_way_door, *policy.elevated)
        if rule.planned and any(rule.matches(path) for path in tracked)
    ]
    assert stale == []
