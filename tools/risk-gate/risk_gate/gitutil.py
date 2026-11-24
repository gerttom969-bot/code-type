import subprocess
from dataclasses import dataclass
from pathlib import Path


class GitError(RuntimeError):
    pass


@dataclass(frozen=True)
class FileChange:
    path: str
    added: int
    deleted: int
    binary: bool


def git(repo: Path, *args: str) -> str:
    proc = subprocess.run(
        ["git", *args], cwd=repo, capture_output=True, text=True, check=False
    )
    if proc.returncode != 0:
        raise GitError(f"git {' '.join(args)} failed: {proc.stderr.strip()}")
    return proc.stdout


def changed_files(repo: Path, base: str, head: str) -> list[FileChange]:
    """Files changed since the merge-base. --no-renames: moving a file out of a
    protected path shows up as a delete there, so it still matches the rules."""
    out = git(repo, "diff", "--numstat", "--no-renames", "-z", f"{base}...{head}")
    changes: list[FileChange] = []
    for record in out.split("\0"):
        if not record:
            continue
        added_s, deleted_s, path = record.split("\t", 2)
        binary = added_s == "-"
        changes.append(
            FileChange(
                path=path,
                added=0 if binary else int(added_s),
                deleted=0 if binary else int(deleted_s),
                binary=binary,
            )
        )
    return changes
