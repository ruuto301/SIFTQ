"""Behavior tests for the dsh verification hook."""

import io
import json
import subprocess
import sys
from pathlib import Path

import pytest

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPOSITORY_ROOT))

from scripts.flow import verify_hook


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    subprocess.run(["git", "init", "-q"], cwd=tmp_path, check=True)
    return tmp_path


def _failure() -> dict:
    return {
        "status": "fix",
        "findings": ["failed: task -t .config/Taskfile.yml ci:lint"],
        "commands": [
            {
                "command": "task -t .config/Taskfile.yml ci:lint",
                "exit_code": 1,
                "stderr_tail": "lint failed",
            }
        ],
    }


def _pass() -> dict:
    return {"status": "pass", "findings": [], "commands": []}


def _run(monkeypatch, mode: str, payload: dict) -> int:
    monkeypatch.setattr(sys, "stdin", io.StringIO(json.dumps(payload)))
    return verify_hook.main([mode])


def _payload(repo: Path, *, command: str | None = None, turn: str = "1") -> dict:
    payload = {
        "session_id": "session-1",
        "turn_id": turn,
        "cwd": str(repo),
        "hook_event_name": "PreToolUse" if command else "Stop",
    }
    if command is not None:
        payload["tool_name"] = "bash"
        payload["tool_input"] = {"command": command}
    return payload


def test_gated_commands_include_commit_push_and_pr() -> None:
    for command in (
        "git commit -m test",
        "git push origin HEAD",
        "gh pr create --fill",
        "task -t .config/Taskfile.yml taqt:commit -- x --execute",
    ):
        assert verify_hook._is_gated_command(command)


def test_read_only_commands_are_not_gated() -> None:
    for command in ("git status", "git diff --stat", "task -t .config/Taskfile.yml ci"):
        assert not verify_hook._is_gated_command(command)


def test_pretool_blocks_gated_command_on_failure(monkeypatch, repo: Path) -> None:
    monkeypatch.setattr(verify_hook, "run_verification", lambda cwd: _failure())

    assert _run(monkeypatch, "pretool", _payload(repo, command="git commit -m test")) == 2


def test_pretool_ignores_non_gated_command(monkeypatch, repo: Path) -> None:
    def unexpected(cwd):
        raise AssertionError("verification should not run")

    monkeypatch.setattr(verify_hook, "run_verification", unexpected)

    assert _run(monkeypatch, "pretool", _payload(repo, command="git status")) == 0


def test_stop_skips_verification_without_changes(monkeypatch, repo: Path) -> None:
    def unexpected(cwd):
        raise AssertionError("verification should not run")

    monkeypatch.setattr(verify_hook, "workspace_has_changes", lambda cwd: False)
    monkeypatch.setattr(verify_hook, "run_verification", unexpected)

    assert _run(monkeypatch, "stop", _payload(repo)) == 0


def test_stop_blocks_until_attempt_limit(monkeypatch, repo: Path) -> None:
    monkeypatch.setattr(verify_hook, "workspace_has_changes", lambda cwd: True)
    monkeypatch.setattr(verify_hook, "run_verification", lambda cwd: _failure())
    payload = _payload(repo)

    assert _run(monkeypatch, "stop", payload) == 2
    assert _run(monkeypatch, "stop", payload) == 2
    assert _run(monkeypatch, "stop", payload) == 0


def test_stop_attempts_are_scoped_to_turn(monkeypatch, repo: Path) -> None:
    monkeypatch.setattr(verify_hook, "workspace_has_changes", lambda cwd: True)
    monkeypatch.setattr(verify_hook, "run_verification", lambda cwd: _failure())

    assert _run(monkeypatch, "stop", _payload(repo, turn="1")) == 2
    assert _run(monkeypatch, "stop", _payload(repo, turn="2")) == 2


def test_stop_clears_attempts_after_pass(monkeypatch, repo: Path) -> None:
    monkeypatch.setattr(verify_hook, "workspace_has_changes", lambda cwd: True)
    monkeypatch.setattr(verify_hook, "run_verification", lambda cwd: _failure())
    payload = _payload(repo)
    assert _run(monkeypatch, "stop", payload) == 2

    monkeypatch.setattr(verify_hook, "run_verification", lambda cwd: _pass())
    assert _run(monkeypatch, "stop", payload) == 0

    monkeypatch.setattr(verify_hook, "run_verification", lambda cwd: _failure())
    assert _run(monkeypatch, "stop", payload) == 2
