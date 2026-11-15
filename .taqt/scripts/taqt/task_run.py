import argparse
import getpass
import json
import os
import subprocess
from pathlib import Path

from scripts.flow.verify_gate import run_verification

from .github_labels import enabled_error
from .profiles import load_profiles, resolve_codex_home, resolve_profile
from .run_record import append_event, create_run_dir, load_state, save_state
from .self_improvement import request_self_improvement
from .task_preflight import preflight_task
from .task_store import (
    DEFAULT_TASK_ROOT,
    block_task,
    load_task,
    next_pending_task,
    readiness_warnings,
    save_task,
)

TERMINAL_STATUSES = {"blocked", "done", "failed"}
DEFAULT_TIMEOUT_SECONDS = 3600


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="taqt-task-run")
    parser.add_argument("task", nargs="?")
    parser.add_argument("--task-root", type=Path, default=DEFAULT_TASK_ROOT)
    parser.add_argument("--loop-root", type=Path, default=Path(".taqt/loops"))
    parser.add_argument("--runs-root", type=Path, default=Path(".taqt/runs"))
    parser.add_argument("--workspace", type=Path, default=Path("."))
    parser.add_argument("--worker-id", default="local")
    parser.add_argument("--resume", type=Path)
    parser.add_argument("--profile")
    parser.add_argument("--codex-home", type=Path)
    parser.add_argument("--skip-readiness-check", action="store_true")
    parser.add_argument("--timeout-seconds", type=int, default=DEFAULT_TIMEOUT_SECONDS)
    args = parser.parse_args(argv)

    try:
        profile = resolve_profile(args.loop_root, args.profile)
        profiles = load_profiles(args.loop_root)
    except ValueError as error:
        print(error)
        return 2
    profile_spec = profiles[profile]

    if args.task:
        task_path, task = load_task(args.task, args.task_root)
    else:
        selected = next_pending_task(args.task_root)
        if selected is None:
            print("No pending taqt tasks.")
            return 0
        task_path, task = selected

    lock_error = _lock_error(task, args.worker_id)
    if lock_error:
        print(lock_error)
        return 2
    if args.resume:
        resume_error = _resume_error(task, args.resume)
        if resume_error:
            print(resume_error)
            return 2
    label_error = enabled_error(task)
    if label_error:
        block_task(task_path, task, label_error)
        print(f"Task {task['id']} is blocked: {label_error}")
        return 2
    if not args.skip_readiness_check and task.get("status") != "running":
        errors = preflight_task(
            task_path,
            task,
            workspace=args.workspace,
            runs_root=args.runs_root,
        )
        if errors:
            print(f"Task {task['id']} is not ready: {'; '.join(errors)}")
            request_path = (task.get("self_improvement") or {}).get("request_path")
            if request_path:
                print(f"Self-improvement requested: {request_path}")
            return 2
        for warning in readiness_warnings(task, workspace=args.workspace):
            print(f"Task {task['id']} readiness warning: {warning}")

    child_environment: dict[str, str] = {}
    if args.codex_home is not None:
        codex_home = resolve_codex_home(args.codex_home)
        child_environment["CODEX_HOME"] = str(codex_home)
    env_keys = profile_spec.get("env_keys", [])
    if not isinstance(env_keys, list) or not all(isinstance(key, str) and key for key in env_keys):
        print(f"taqt profile {profile} has invalid env_keys.")
        return 2
    for env_key in env_keys:
        api_key = os.environ.get(env_key) or _prompt_api_key(env_key)
        if not api_key:
            print(f"{env_key} is required.")
            return 2
        child_environment[env_key] = api_key

    run_dir = args.resume or create_run_dir(str(task["id"]), args.runs_root)
    previous_state = load_state(run_dir) or {}
    session_id = previous_state.get("session_id")
    if args.resume and not session_id:
        print(f"Resume run has no dsh session: {run_dir}")
        return 2

    workspace = args.workspace.resolve()
    dsh_result = _run_dsh(
        workspace=workspace,
        task_path=task_path.resolve(),
        run_dir=run_dir,
        session_id=session_id,
        timeout_seconds=args.timeout_seconds,
        child_environment=child_environment,
    )
    session_id = dsh_result["session_id"] or session_id

    label_error = enabled_error(task)
    if label_error:
        block_task(task_path, task, label_error)
        print(f"Task {task['id']} is blocked: {label_error}")
        return 2

    verification = run_verification(cwd=workspace, env=child_environment)
    if dsh_result["failed"]:
        status = "failed"
        reason = dsh_result["reason"] or "dsh failed"
    elif verification["status"] != "pass":
        status = "blocked"
        reason = "verification failed"
    else:
        status = "done"
        reason = "dsh completed and verification passed"

    state = {
        "task_id": task["id"],
        "status": status,
        "phase": "verification" if status == "blocked" else status,
        "session_id": session_id,
        "dsh_exit_code": dsh_result["exit_code"],
        "verification": verification,
        "blocked_reason": None if status == "done" else reason,
    }
    save_state(run_dir, state)
    append_event(
        run_dir,
        {
            "type": "terminal",
            "status": status,
            "reason": reason,
            "session_id": session_id,
            "dsh_exit_code": dsh_result["exit_code"],
            "verification": verification["status"],
        },
    )

    task["status"] = status
    task["blocked_reason"] = None if status == "done" else reason
    task["phase"] = state["phase"]
    task["run"] = {
        "id": run_dir.name,
        "state_path": str(run_dir / "state.json"),
        "events_path": str(run_dir / "events.jsonl"),
        "session_id": session_id,
    }
    task["worker"] = {"id": None, "heartbeat_at": None}
    if status != "done":
        request_self_improvement(
            task_path=task_path,
            task=task,
            reason=reason,
            event=f"loop_{status}",
            runs_root=args.runs_root,
            workspace=workspace,
            run_dir=run_dir,
        )
    else:
        request_self_improvement(
            task_path=task_path,
            task=task,
            reason=reason,
            event="loop_done",
            runs_root=args.runs_root,
            workspace=workspace,
            run_dir=run_dir,
        )
    save_task(task_path, task)
    print(run_dir)
    return 0 if status in {"done", "blocked"} else 1


def _run_dsh(
    *,
    workspace: Path,
    task_path: Path,
    run_dir: Path,
    session_id: str | None,
    timeout_seconds: int,
    child_environment: dict[str, str],
) -> dict[str, object]:
    command = _dsh_command(workspace, session_id)
    prompt = (
        "Use the taqt-loop-runner skill to complete this taqt task. "
        f"Task file: {task_path}. "
        "Work only inside the current workspace. Run the repository verification before you stop. "
        "Do not commit, push, or open a pull request; the taqt runner performs those steps after verification."
    )
    append_event(run_dir, {"type": "dsh_started", "session_id": session_id, "command": command})
    try:
        completed = subprocess.run(
            command,
            cwd=workspace,
            input=prompt,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env={**os.environ, **child_environment},
            timeout=timeout_seconds,
            check=False,
        )
    except FileNotFoundError:
        return {
            "failed": True,
            "reason": "dsh executable was not found",
            "exit_code": None,
            "session_id": session_id,
        }
    except subprocess.TimeoutExpired as error:
        stdout = error.stdout if isinstance(error.stdout, str) else ""
        stderr = error.stderr if isinstance(error.stderr, str) else ""
        (run_dir / "dsh.jsonl").write_text(stdout, encoding="utf-8")
        (run_dir / "dsh.stderr").write_text(stderr, encoding="utf-8")
        return {
            "failed": True,
            "reason": f"dsh timed out after {timeout_seconds}s",
            "exit_code": None,
            "session_id": _parse_session_id(stdout) or session_id,
        }

    (run_dir / "dsh.jsonl").write_text(completed.stdout, encoding="utf-8")
    (run_dir / "dsh.stderr").write_text(completed.stderr, encoding="utf-8")
    append_event(
        run_dir,
        {
            "type": "dsh_finished",
            "exit_code": completed.returncode,
            "session_id": _parse_session_id(completed.stdout) or session_id,
        },
    )
    if completed.returncode != 0:
        tail = (completed.stderr or completed.stdout).strip()[-2000:]
        return {
            "failed": True,
            "reason": f"dsh exited with {completed.returncode}: {tail}",
            "exit_code": completed.returncode,
            "session_id": _parse_session_id(completed.stdout) or session_id,
        }
    return {
        "failed": False,
        "reason": None,
        "exit_code": 0,
        "session_id": _parse_session_id(completed.stdout) or session_id,
    }


def _dsh_command(workspace: Path, session_id: str | None) -> list[str]:
    command = [
        "dsh",
        "--profile",
        "headless",
        "--patch",
        ".config/dsh/cordis.patch.yml",
    ]
    if _hooks_installed("headless"):
        command.extend(["--patch", ".config/dsh/hooks.patch.yml"])
    command.extend(
        [
            "--permission-mode",
            "workspace-write",
            "--approval-policy",
            "never",
            "--json",
        ]
    )
    if session_id:
        command.extend(["--session-id", session_id])
    git_dir = _git_common_dir(workspace)
    if git_dir:
        command.extend(["--add-dir", git_dir])
    command.append("-")
    return command


def _hooks_installed(profile: str) -> bool:
    dsh_home = Path(os.environ.get("DSH_HOME") or Path.home() / ".dsh")
    package_file = dsh_home / "profiles" / profile / "package.json"
    if not package_file.is_file():
        return False
    return '"@deepseek-ai/dsh-hooks-codex"' in package_file.read_text(encoding="utf-8")


def _git_common_dir(workspace: Path) -> str | None:
    completed = subprocess.run(
        ["git", "rev-parse", "--path-format=absolute", "--git-common-dir"],
        cwd=workspace,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if completed.returncode != 0:
        return None
    value = completed.stdout.strip()
    return value or None


def _parse_session_id(stdout: str) -> str | None:
    for line in stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not isinstance(event, dict):
            continue
        value = event.get("sessionId")
        if isinstance(value, str) and value:
            return value
        session = event.get("session")
        if isinstance(session, dict):
            value = session.get("sessionId")
            if isinstance(value, str) and value:
                return value
    return None


def _lock_error(task: dict[str, object], worker_id: str) -> str | None:
    if task.get("status") != "running":
        return None
    worker = task.get("worker")
    current_worker = worker.get("id") if isinstance(worker, dict) else None
    if current_worker in {None, worker_id}:
        return None
    return f"Task {task['id']} is already running by worker {current_worker}."


def _resume_error(task: dict[str, object], resume_dir: Path) -> str | None:
    run = task.get("run")
    expected_id = run.get("id") if isinstance(run, dict) else None
    if expected_id and expected_id != resume_dir.name:
        return f"Resume run {resume_dir.name} does not match task run {expected_id}."
    state = load_state(resume_dir)
    if state is None:
        return f"Resume run is missing state.json: {resume_dir}"
    if not state.get("session_id"):
        return f"Resume run has no dsh session: {resume_dir}"
    if task.get("status") in TERMINAL_STATUSES and not expected_id:
        return f"Task {task['id']} has terminal status {task.get('status')} and no resumable run."
    return None


def _prompt_api_key(env_key: str) -> str:
    try:
        return getpass.getpass(f"{env_key}: ").strip()
    except (EOFError, KeyboardInterrupt):
        return ""


if __name__ == "__main__":
    raise SystemExit(main())
