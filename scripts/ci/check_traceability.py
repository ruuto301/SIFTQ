#!/usr/bin/env python3
import re
import sys
from pathlib import Path

from checker import repository_root


DEFINITION_FILES = (
    "docs/requirements/requirements-analysis.md",
    "docs/requirements/domain.md",
)
ID_RE = re.compile(r"\b(?:BDD|INV)-TM-\d{3}\b")


def defined_ids(text: str) -> set[str]:
    return {match.group(0) for match in ID_RE.finditer(text)}


def collect_defined(root: Path) -> set[str]:
    ids: set[str] = set()
    for relative in DEFINITION_FILES:
        path = root / relative
        if path.is_file():
            ids |= defined_ids(path.read_text(encoding="utf-8"))
    return ids


def collect_referenced(root: Path) -> set[str]:
    ids: set[str] = set()
    tests = root / "tests"
    if not tests.is_dir():
        return ids
    for path in tests.rglob("*"):
        if path.suffix in {".ts", ".tsx"}:
            ids |= defined_ids(path.read_text(encoding="utf-8"))
    return ids


def find_violations(defined: set[str], referenced: set[str]) -> list[str]:
    return [
        *(f"tests が未定義の ID を参照している: {id}" for id in sorted(referenced - defined)),
        *(f"定義された ID を参照するテストが無い: {id}" for id in sorted(defined - referenced)),
    ]


def main() -> int:
    root = repository_root()
    violations = find_violations(collect_defined(root), collect_referenced(root))
    for violation in violations:
        print(violation)
    return 1 if violations else 0


if __name__ == "__main__":
    sys.exit(main())
