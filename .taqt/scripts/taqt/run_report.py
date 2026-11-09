import argparse
from pathlib import Path
from typing import Any

from .run_record import load_events, load_state


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="taqt-run-report")
    parser.add_argument("run_dir", type=Path)
    args = parser.parse_args(argv)

    state = load_state(args.run_dir)
    if state is None:
        print(f"No state.json found in {args.run_dir}")
        return 1
    events = load_events(args.run_dir)
    print(render_report(state, events))
    return 0


def render_report(state: dict[str, Any], events: list[dict[str, Any]]) -> str:
    verification = state.get("verification")
    verification_status = (
        verification.get("status") if isinstance(verification, dict) else verification
    )
    lines = [
        f"# taqt run {state.get('task_id')}",
        "",
        f"- status: `{state.get('status')}`",
        f"- phase: `{state.get('phase')}`",
        f"- dsh session: `{state.get('session_id')}`",
        f"- dsh exit code: `{state.get('dsh_exit_code')}`",
        f"- verification: `{verification_status}`",
    ]
    if state.get("blocked_reason"):
        lines.append(f"- blocked reason: `{state.get('blocked_reason')}`")
    lines.extend(["", "## Recent events"])
    for event in events[-10:]:
        lines.append(_event_line(event))
    return "\n".join(lines) + "\n"


def _event_line(event: dict[str, Any]) -> str:
    event_type = event.get("type")
    if event_type == "dsh_started":
        return f"- dsh started (session `{event.get('session_id')}`)"
    if event_type == "dsh_finished":
        return f"- dsh finished (exit `{event.get('exit_code')}`)"
    if event_type == "terminal":
        return (
            f"- terminal: `{event.get('status')}` "
            f"(verification `{event.get('verification')}`)"
        )
    if event_type == "self_improvement_requested":
        return f"- self-improvement requested: `{event.get('kind')}`"
    return f"- {event_type}: `{event.get('reason') or event.get('status')}`"


if __name__ == "__main__":
    raise SystemExit(main())
