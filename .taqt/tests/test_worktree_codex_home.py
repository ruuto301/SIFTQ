"""Tests for shared Codex home and dsh execution in taqt runs."""

import sys
from pathlib import Path

import pytest
import yaml

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPOSITORY_ROOT / ".taqt" / "scripts"))

from taqt.profiles import resolve_codex_home
from taqt.task_run import _dsh_command, _parse_session_id, main as task_run_main
from taqt.task_store import create_issue_task


@pytest.fixture(autouse=True)
def allow_enabled_label(monkeypatch) -> None:
    monkeypatch.setattr("taqt.task_run.enabled_error", lambda _task: None)


def test_profiles_have_no_worktree_codex_home_or_loop() -> None:
    profiles = yaml.safe_load(
        (REPOSITORY_ROOT / ".taqt" / "config" / "profiles.yaml").read_text(
            encoding="utf-8"
        )
    )["profiles"]

    assert set(profiles) == {"main"}
    assert all("codex_home" not in profile for profile in profiles.values())
    assert "loop" not in profiles["main"]
    assert profiles["main"]["env_keys"] == ["DEEPSEEK_API_KEY"]


def test_dsh_command_uses_headless_profile_and_gates() -> None:
    workspace = Path.cwd()

    command = _dsh_command(workspace, None)

    assert command[:5] == [
        "dsh",
        "--profile",
        "headless",
        "--patch",
        ".config/dsh/cordis.patch.yml",
    ]
    assert "--permission-mode" in command
    assert command[command.index("--permission-mode") + 1] == "workspace-write"
    assert command[command.index("--approval-policy") + 1] == "never"
    assert command[-1] == "-"


def test_dsh_command_resumes_a_session() -> None:
    command = _dsh_command(Path.cwd(), "session-123")

    assert command[command.index("--session-id") + 1] == "session-123"


def test_parse_session_id_reads_the_json_stream() -> None:
    stream = "\n".join(
        [
            '{"type":"session","sessionId":"session-abc"}',
            '{"type":"final","text":"done"}',
        ]
    )

    assert _parse_session_id(stream) == "session-abc"


def test_resolve_codex_home_uses_shared_default(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("HOME", str(tmp_path))

    assert resolve_codex_home() == tmp_path / ".codex"


def test_resolve_codex_home_preserves_explicit_override(tmp_path: Path) -> None:
    override = tmp_path / "isolated-codex"

    assert resolve_codex_home(override) == override


def test_task_run_passes_deepseek_key_and_verifies(
    tmp_path: Path, monkeypatch
) -> None:
    loop_root = tmp_path / "loops"
    loop_root.mkdir()
    (tmp_path / "config").mkdir()
    (tmp_path / "config" / "profiles.yaml").write_text(
        yaml.safe_dump(
            {
                "profiles": {
                    "deepseek": {
                        "env_keys": ["DEEPSEEK_API_KEY"],
                    }
                }
            },
            sort_keys=False,
        ),
        encoding="utf-8",
    )
    task_root = tmp_path / "tasks"
    task_root.mkdir()
    task_path, _ = create_issue_task(
        repo="owner/repo", issue_number=273, task_root=task_root
    )
    calls: list[dict[str, object]] = []
    monkeypatch.setattr(
        "taqt.task_run._run_dsh",
        lambda **kwargs: calls.append(kwargs)
        or {
            "failed": False,
            "reason": None,
            "exit_code": 0,
            "session_id": "session-123",
        },
    )
    monkeypatch.setattr(
        "taqt.task_run.run_verification",
        lambda **kwargs: {"status": "pass", "findings": [], "commands": []},
    )
    monkeypatch.setenv("DEEPSEEK_API_KEY", "deepseek-key")

    exit_code = task_run_main(
        [
            str(task_path),
            "--loop-root",
            str(loop_root),
            "--task-root",
            str(task_root),
            "--runs-root",
            str(tmp_path / "runs"),
            "--workspace",
            str(tmp_path),
            "--skip-readiness-check",
            "--profile",
            "deepseek",
        ]
    )

    assert exit_code == 0
    assert calls[0]["child_environment"] == {"DEEPSEEK_API_KEY": "deepseek-key"}


def test_task_run_blocks_when_verification_fails(
    tmp_path: Path, monkeypatch
) -> None:
    loop_root = tmp_path / "loops"
    loop_root.mkdir()
    (tmp_path / "config").mkdir()
    (tmp_path / "config" / "profiles.yaml").write_text(
        yaml.safe_dump(
            {"profiles": {"main": {"env_keys": ["DEEPSEEK_API_KEY"]}}},
            sort_keys=False,
        ),
        encoding="utf-8",
    )
    task_root = tmp_path / "tasks"
    task_root.mkdir()
    task_path, _ = create_issue_task(
        repo="owner/repo", issue_number=273, task_root=task_root
    )
    monkeypatch.setattr(
        "taqt.task_run._run_dsh",
        lambda **kwargs: {
            "failed": False,
            "reason": None,
            "exit_code": 0,
            "session_id": "session-123",
        },
    )
    monkeypatch.setattr(
        "taqt.task_run.run_verification",
        lambda **kwargs: {"status": "fix", "findings": [], "commands": []},
    )
    monkeypatch.setenv("DEEPSEEK_API_KEY", "deepseek-key")

    exit_code = task_run_main(
        [
            str(task_path),
            "--loop-root",
            str(loop_root),
            "--task-root",
            str(task_root),
            "--runs-root",
            str(tmp_path / "runs"),
            "--workspace",
            str(tmp_path),
            "--skip-readiness-check",
        ]
    )

    assert exit_code == 0
    state_path = next((tmp_path / "runs").rglob("state.json"))
    state = yaml.safe_load(state_path.read_text(encoding="utf-8"))
    assert state["status"] == "blocked"
