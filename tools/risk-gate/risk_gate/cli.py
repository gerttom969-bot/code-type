import argparse
import json
import os
import sys
from dataclasses import asdict
from pathlib import Path

from risk_gate.decision import decide
from risk_gate.gitutil import changed_files, git
from risk_gate.ids_guard import removed_ids
from risk_gate.report import render
from risk_gate.rules import load_policy


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="risk-gate")
    parser.add_argument("--repo", type=Path, default=Path("."))
    parser.add_argument("--policy", type=Path, required=True)
    parser.add_argument("--base", required=True)
    parser.add_argument("--head", required=True)
    parser.add_argument("--pr", type=int, required=True)
    parser.add_argument("--labels", default="")
    parser.add_argument("--summary", type=Path, help="append the markdown report to this file")
    parser.add_argument("--output-json", type=Path)
    args = parser.parse_args(argv)

    policy = load_policy(args.policy)
    changes = changed_files(args.repo, args.base, args.head)

    removed: list[str] = []
    if any(c.path.startswith("content/") for c in changes):
        merge_base = git(args.repo, "merge-base", args.base, args.head).strip()
        removed = removed_ids(args.repo, merge_base, args.head)

    labels = frozenset(item.strip() for item in args.labels.split(",") if item.strip())
    decision = decide(
        changes=changes,
        policy=policy,
        removed_content_ids=removed,
        labels=labels,
        pr_number=args.pr,
        # `or`, not a default: an unset secret arrives as "" and must not become the salt.
        audit_salt=os.environ.get("RISK_AUDIT_SALT") or "codetype",
    )

    report = render(decision, args.pr)
    if args.summary:
        with args.summary.open("a", encoding="utf-8") as handle:
            handle.write(report)
    else:
        sys.stdout.write(report)

    if args.output_json:
        payload = {"pr": args.pr, **asdict(decision)}
        args.output_json.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    return decision.exit_code


if __name__ == "__main__":
    sys.exit(main())
