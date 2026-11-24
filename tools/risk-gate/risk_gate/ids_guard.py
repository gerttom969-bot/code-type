import json
from pathlib import Path

from risk_gate.gitutil import GitError, git

CONTENT_DIR = "content"


def _ids_at(repo: Path, ref: str) -> set[str]:
    names = git(repo, "ls-tree", "-r", "--name-only", "-z", ref, "--", CONTENT_DIR).split("\0")
    ids: set[str] = set()
    for name in names:
        if not name.endswith(".json"):
            continue
        try:
            data = json.loads(git(repo, "show", f"{ref}:{name}"))
        except (GitError, json.JSONDecodeError):
            continue  # a file that stops parsing "loses" its id, which blocks the PR
        # TODO(question): Phase 2 content schema. Confirm every content file has a
        # top-level string "id".
        if isinstance(data, dict) and isinstance(data.get("id"), str):
            ids.add(data["id"])
    return ids


def removed_ids(repo: Path, merge_base: str, head: str) -> list[str]:
    """Content ids that existed at the merge-base but are gone at head."""
    return sorted(_ids_at(repo, merge_base) - _ids_at(repo, head))
