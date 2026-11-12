"""dsh hook entry point for the repository verification gate.

The Codex-compatible bridge runs this script with a hook payload on stdin. A
pre-tool hook blocks commit/push/PR commands when verification fails. The stop
hook runs verification before the agent finishes and blocks the stop until it
passes, up to a bounded number of attempts.
"""

import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    from .verify_gate import run_verification, workspace_has_changes
except ImportError:
    from verify_gate import run_verification, workspace_has_changes

MAX_STOP_ATTEMPTS = 3
GATED_COMMAND_PATTERNS = (
    r"\bgit\s+commit\b",
    r"\bgit\s+push\b",
    r"\bgh\s+pr\s+(create|merge|ready)\b",
    r"\btaqt:(commit|push|pr|merge|auto)\b",
)
GATED_COMMAND = tuple(re.compile(pattern) for pattern in GATED_COMMAND_PATTERNS)


def main(argv: list[str] | None = None) -> int:
    args = argv if argv is not None else sys.argv[1:]
    mode = args[0] if args else "stop"
    payload = _read_payload()
    cwd = Path(payload.get("cwd") or Path.cwd())

    if mode == "pretool":
        return _pretool(payload, cwd)
    return _stop(payload, cwd)


def _read_payload() -> dict[str, Any]:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


def _pretool(payload: dict[str, Any], cwd: Path) -> int:
    tool_name = str(payload.get("tool_name") or payload.get("hook_event_name") or "").lower()
    if tool_name not in {"bash", "pretooluse"}:
        return 0
    tool_input = payload.get("tool_input")
    command = tool_input.get("command") if isinstance(tool_input, dict) else None
    if not isinstance(command, str) or not _is_gated_command(command):
        return 0

    result = run_verification(cwd=cwd)
    if result["status"] == "pass":
        return 0
    _write_stderr(_failure_summary(result, cwd))
    return 2


def _stop(payload: dict[str, Any], cwd: Path) -> int:
    if not workspace_has_changes(cwd):
        return 0

    result = run_verification(cwd=cwd)
    if result["status"] == "pass":
        _clear_attempts(payload, cwd)
        return 0

    attempts = _record_attempt(payload, cwd)
    if attempts < MAX_STOP_ATTEMPTS:
        _write_stderr(
            _failure_summary(result, cwd)
            + f"\nVerification failed (attempt {attempts}/{MAX_STOP_ATTEMPTS}); "
            "fix the failures before finishing."
        )
        return 2

    _write_stderr(
        _failure_summary(result, cwd)
        + f"\nVerification failed after {MAX_STOP_ATTEMPTS} attempts. "
        "Stopping; commit, push, and PR remain blocked."
    )
    return 0


def _is_gated_command(command: str) -> bool:
    normalized = " ".join(command.split())
    return any(pattern.search(normalized) for pattern in GATED_COMMAND)


def _failure_summary(result: dict[str, Any], cwd: Path) -> str:
    lines = [f"Verification failed in {cwd}."]
    findings = result.get("findings")
    if isinstance(findings, list):
        lines.extend(f"- {item}" for item in findings if isinstance(item, str))
    commands = result.get("commands")
    if isinstance(commands, list):
        for entry in commands:
            if not isinstance(entry, dict) or entry.get("exit_code") == 0:
                continue
            command = entry.get("command")
            if isinstance(command, str):
                lines.append(f"- failed: {command}")
            tail = entry.get("stderr_tail") or entry.get("stdout_tail")
            if isinstance(tail, str) and tail.strip():
                lines.append(tail.strip()[-2000:])
    return "\n".join(lines)[-6000:]


def _state_path(payload: dict[str, Any], cwd: Path) -> Path:
    session_id = _safe_id(str(payload.get("session_id") or "session"))
    turn_id = _safe_id(str(payload.get("turn_id") or "turn"))
    return _state_root(cwd) / f"{session_id}-{turn_id}.json"


def _state_root(cwd: Path) -> Path:
    completed = subprocess.run(
        ["git", "rev-parse", "--path-format=absolute", "--git-common-dir"],
        cwd=cwd,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if completed.returncode == 0 and completed.stdout.strip():
        root = Path(completed.stdout.strip()) / "dsh-verify"
    else:
        root = Path("/tmp") / "dsh-verify"
    root.mkdir(parents=True, exist_ok=True)
    return root


def _record_attempt(payload: dict[str, Any], cwd: Path) -> int:
    path = _state_path(payload, cwd)
    attempts = 0
    if path.is_file():
        try:
            state = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            state = {}
        if isinstance(state, dict):
            attempts = int(state.get("attempts") or 0)
    attempts += 1
    path.write_text(
        json.dumps(
            {
                "attempts": attempts,
                "session_id": payload.get("session_id"),
                "turn_id": payload.get("turn_id"),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    return attempts


def _clear_attempts(payload: dict[str, Any], cwd: Path) -> None:
    _state_path(payload, cwd).unlink(missing_ok=True)


def _safe_id(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "-", value)


def _write_stderr(message: str) -> None:
    print(message, file=sys.stderr)


if __name__ == "__main__":
    raise SystemExit(main())
