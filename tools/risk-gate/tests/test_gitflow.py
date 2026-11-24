"""End-to-end checks against a real throwaway git repository.

The unit tests in test_decision.py never touch git. These do: diff parsing, --no-renames,
merge-base handling and the content-id guard all run against real commits.
"""

import json
import subprocess
from pathlib import Path

import pytest

from risk_gate.cli import main
from risk_gate.gitutil import changed_files
from risk_gate.ids_guard import removed_ids

POLICY = Path(__file__).parents[3] / "risk" / "policy.yml"


def git(repo: Path, *args: str) -> str:
    proc = subprocess.run(
        ["git", "-c", "user.name=t", "-c", "user.email=t@example.com", *args],
        cwd=repo,
        capture_output=True,
        text=True,
        check=True,
    )
    return proc.stdout


def write(repo: Path, rel: str, text: str) -> None:
    target = repo / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding="utf-8")


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    git(tmp_path, "init", "-q", "-b", "main")
    write(tmp_path, "src/security/safe-html.js", "export const x = 1;\n" * 20)
    write(tmp_path, "src/ui/dom.js", "export const y = 1;\n")
    write(tmp_path, "content/problems/two-sum.json", json.dumps({"id": "two-sum"}))
    git(tmp_path, "add", "-A")
    git(tmp_path, "commit", "-q", "-m", "base")
    git(tmp_path, "checkout", "-q", "-b", "pr")
    return tmp_path


def commit_all(repo: Path) -> None:
    git(repo, "add", "-A")
    git(repo, "commit", "-q", "-m", "change")
    git(repo, "checkout", "-q", "main")  # CI inspects the PR as data from a base checkout


def gate(repo: Path, labels: str = "") -> int:
    return main(
        [
            "--repo", str(repo),
            "--policy", str(POLICY),
            "--base", "main",
            "--head", "pr",
            "--pr", "7",
            "--labels", labels,
        ]
    )  # fmt: skip


def test_small_ui_change_is_cleared(repo: Path) -> None:
    write(repo, "src/ui/dom.js", "export const y = 2;\n")
    commit_all(repo)
    assert gate(repo) == 0


def test_moving_a_file_out_of_a_protected_path_is_still_caught(repo: Path) -> None:
    git(repo, "mv", "src/security/safe-html.js", "src/ui/safe-html.js")
    commit_all(repo)
    paths = {c.path for c in changed_files(repo, "main", "pr")}
    assert "src/security/safe-html.js" in paths  # shows up as a delete, not a rename
    assert gate(repo) == 1


def test_protected_change_passes_only_with_the_override_label(repo: Path) -> None:
    write(repo, "src/security/safe-html.js", "export const x = 2;\n")
    commit_all(repo)
    assert gate(repo) == 1
    assert gate(repo, labels="critical-reviewed") == 0


def test_deleting_a_content_id_is_blocked_even_with_the_label(repo: Path) -> None:
    git(repo, "rm", "-q", "content/problems/two-sum.json")
    commit_all(repo)
    assert gate(repo, labels="critical-reviewed") == 2


def test_moving_a_content_file_keeps_its_id(repo: Path) -> None:
    git(repo, "mv", "content/problems/two-sum.json", "content/problems/renamed.json")
    commit_all(repo)
    base = git(repo, "merge-base", "main", "pr").strip()
    assert removed_ids(repo, base, "pr") == []


def test_base_moving_forward_does_not_leak_into_the_diff(repo: Path) -> None:
    """`base...head` diffs against the merge-base, so unrelated commits on main are ignored."""
    write(repo, "src/ui/dom.js", "export const y = 3;\n")
    commit_all(repo)
    write(repo, "src/security/safe-html.js", "export const x = 99;\n")
    git(repo, "add", "-A")
    git(repo, "commit", "-q", "-m", "unrelated change on main")
    paths = {c.path for c in changed_files(repo, "main", "pr")}
    assert paths == {"src/ui/dom.js"}
