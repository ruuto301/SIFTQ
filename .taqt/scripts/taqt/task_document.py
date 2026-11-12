import json
from pathlib import Path
from typing import Any

import yaml


def load_document(path: Path) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8")
    if path.suffix.lower() == ".json":
        payload = json.loads(text)
    else:
        payload = yaml.safe_load(text)
    if not isinstance(payload, dict):
        raise ValueError(f"{path} must contain a mapping")
    return payload


def write_document(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        yaml.safe_dump(payload, allow_unicode=True, sort_keys=False),
        encoding="utf-8",
    )


def validate_task(task: dict[str, Any]) -> None:
    if not isinstance(task.get("id"), str) or not task["id"]:
        raise ValueError("task.id is required")
    source = task.get("source")
    if not isinstance(source, dict) or source.get("type") != "github_issue":
        raise ValueError("task.source.type must be github_issue")
    if not source.get("repo") or not source.get("issue_number"):
        raise ValueError("task.source.repo and source.issue_number are required")
    if task.get("status") not in {"pending", "running", "blocked", "done", "failed"}:
        raise ValueError("task.status is invalid")
    branch_summary = task.get("branch_summary")
    if branch_summary is not None and not isinstance(branch_summary, str):
        raise ValueError("task.branch_summary must be a string when present")
    branch = task.get("branch")
    if branch is not None and not isinstance(branch, str):
        raise ValueError("task.branch must be a string when present")
