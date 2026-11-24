from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pathspec
import yaml


@dataclass(frozen=True)
class Rule:
    pattern: str
    reason: str
    planned: bool
    spec: pathspec.GitIgnoreSpec

    def matches(self, path: str) -> bool:
        return bool(self.spec.match_file(path))


@dataclass(frozen=True)
class Policy:
    one_way_door: tuple[Rule, ...]
    elevated: tuple[Rule, ...]
    threshold: float
    ood_max_lines: int
    ood_max_files: int
    audit_rate: float


@dataclass(frozen=True)
class Hit:
    rule: Rule
    path: str


def _rules(raw: list[dict[str, Any]]) -> tuple[Rule, ...]:
    rules: list[Rule] = []
    for item in raw:
        pattern = str(item["pattern"])
        rules.append(
            Rule(
                pattern=pattern,
                reason=str(item["reason"]),
                planned=bool(item.get("planned", False)),
                spec=pathspec.GitIgnoreSpec.from_lines([pattern]),
            )
        )
    return tuple(rules)


def load_policy(path: Path) -> Policy:
    raw: dict[str, Any] = yaml.safe_load(path.read_text(encoding="utf-8"))
    if raw.get("version") != 1:
        raise ValueError(f"unsupported policy version: {raw.get('version')!r}")
    score = raw["score"]
    return Policy(
        one_way_door=_rules(raw["one_way_door"]),
        elevated=_rules(raw["elevated"]),
        threshold=float(score["threshold"]),
        ood_max_lines=int(score["ood_max_lines"]),
        ood_max_files=int(score["ood_max_files"]),
        audit_rate=float(raw["audit_rate"]),
    )


def find_hits(rules: Iterable[Rule], paths: Iterable[str]) -> list[Hit]:
    path_list = list(paths)
    return [Hit(rule, p) for rule in rules for p in path_list if rule.matches(p)]
