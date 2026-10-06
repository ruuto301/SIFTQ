#!/usr/bin/env python3
import argparse
import getpass
import json
import os
import re
import subprocess
import tempfile
from dataclasses import asdict, dataclass
from pathlib import Path

VERSION_PATTERN = re.compile(r"^v?(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$")
WORKER_PREFIXES = ("src/", "migrations/")
CF_CONFIGS = ("cloudflare.config.ts", "wrangler.config.ts")
D1_ID_PATTERN = re.compile(r'bindings\.d1\(\{[^}]*?id:\s*"([0-9a-fA-F-]{36})"', re.DOTALL)


@dataclass(frozen=True)
class ReleasePlan:
    version: str | None
    ref: str
    base: str | None
    latest_tag: str | None
    next_patch: str | None
    next_minor: str | None
    prs: list[str]
    worker_change: bool
    migrations: list[str]
    mode: str


def command(*args: str) -> str:
    return subprocess.check_output(args, text=True, stderr=subprocess.DEVNULL).strip()


def normalized_version(value: str) -> str:
    match = VERSION_PATTERN.fullmatch(value)
    if match is None:
        raise ValueError("version must be vX.Y.Z or X.Y.Z")
    return ".".join(match.groups())


def tag_name(version: str) -> str:
    return f"v{normalized_version(version)}"


def changed_paths(base: str | None, ref: str) -> list[str]:
    if base is None:
        return []
    return [line for line in command("git", "diff", "--name-only", f"{base}..{ref}").splitlines() if line]


def pr_changed_paths(pr: str) -> list[str]:
    payload = json.loads(command("gh", "pr", "view", pr, "--json", "files"))
    return [str(entry["path"]) for entry in payload.get("files") or [] if entry.get("path")]


def pr_union_paths(prs: list[str]) -> list[str]:
    return list(dict.fromkeys(path for pr in prs for path in pr_changed_paths(pr)))


def latest_tag() -> str | None:
    try:
        tag = command("git", "describe", "--tags", "--abbrev=0", "--match", "v[0-9]*")
    except subprocess.CalledProcessError:
        return None
    return tag if VERSION_PATTERN.fullmatch(tag) else None


def next_versions(latest: str | None) -> tuple[str | None, str | None]:
    if latest is None:
        return None, None
    major, minor, patch = (int(part) for part in normalized_version(latest).split("."))
    return f"v{major}.{minor}.{patch + 1}", f"v{major}.{minor + 1}.0"


def file_at(ref: str, path: str) -> str | None:
    try:
        return command("git", "show", f"{ref}:{path}")
    except subprocess.CalledProcessError:
        return None


def cf_config_at(ref: str) -> tuple[str | None, ...]:
    return tuple(file_at(ref, path) for path in CF_CONFIGS)


def worker_config_changed(base: str | None, ref: str) -> bool:
    if base is None:
        return False
    return cf_config_at(base) != cf_config_at(ref)


def d1_database_id(path: Path = Path("cloudflare.config.ts")) -> str:
    match = D1_ID_PATTERN.search(path.read_text(encoding="utf-8"))
    if match is None:
        raise ValueError("D1 database id not found in cloudflare.config.ts")
    return match.group(1)


def build_plan(version: str | None, ref: str, base: str | None, prs: list[str] | None = None) -> ReleasePlan:
    prs = list(prs or [])
    resolved_ref = command("git", "rev-parse", f"{ref}^{{commit}}")
    paths = pr_union_paths(prs) if prs else changed_paths(base, resolved_ref)
    migrations = [path for path in paths if path.startswith("migrations/")]
    worker_change = (
        any(path.startswith(WORKER_PREFIXES) or path == "bun.lock" for path in paths)
        or worker_config_changed(base, resolved_ref)
        or (base is None and any(path in CF_CONFIGS for path in paths))
    )
    tag = latest_tag()
    next_patch, next_minor = next_versions(tag)
    return ReleasePlan(
        version=tag_name(version) if version else None,
        ref=resolved_ref,
        base=base,
        latest_tag=tag,
        next_patch=next_patch,
        next_minor=next_minor,
        prs=prs,
        worker_change=worker_change,
        migrations=migrations,
        mode="release+deploy" if worker_change else "release-only",
    )


def require_execute(args: argparse.Namespace) -> None:
    if not args.execute:
        raise ValueError("This operation changes external or repository state; pass --execute.")


def require_clean() -> None:
    if command("git", "status", "--porcelain"):
        raise ValueError("worktree must be clean")


def deploy_command(secrets_file: Path | None) -> list[str]:
    command_args = ["bun", "x", "cf", "deploy"]
    if secrets_file is not None:
        command_args += ["--secrets-file", str(secrets_file)]
    return command_args


def secrets_merge_patch(
    client_id: str, client_secret: str, allowed_login: str, session_secret: str
) -> str:
    return json.dumps(
        {
            "secrets": {
                "GITHUB_CLIENT_ID": {"type": "secret_text", "text": client_id},
                "GITHUB_CLIENT_SECRET": {"type": "secret_text", "text": client_secret},
                "GITHUB_ALLOWED_LOGIN": {"type": "secret_text", "text": allowed_login},
                "SESSION_SECRET": {"type": "secret_text", "text": session_secret},
            }
        },
        ensure_ascii=False,
    )


def read_secret(name: str) -> str:
    value = os.environ.get(name, "").strip()
    return value or getpass.getpass(f"{name}: ").strip()


def apply_secrets(worker: str, payload: str) -> None:
    Path("tmp").mkdir(exist_ok=True)
    descriptor, raw_path = tempfile.mkstemp(dir="tmp", prefix="cloudflare-secrets-", suffix=".json")
    path = Path(raw_path)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            handle.write(payload)
        subprocess.run(
            ["bun", "x", "cf", "workers", "secrets", "bulk", "--worker", worker, "--file", str(path)],
            check=True,
        )
    finally:
        path.unlink(missing_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Plan and execute releases and Worker deployments.")
    subparsers = parser.add_subparsers(dest="operation", required=True)
    plan = subparsers.add_parser("plan")
    plan.add_argument("--version")
    plan.add_argument("--ref", default="HEAD")
    plan.add_argument("--base")
    plan.add_argument("--pr", action="append", default=[])
    release = subparsers.add_parser("release")
    release.add_argument("--version", required=True)
    release.add_argument("--ref", default="HEAD")
    release.add_argument("--execute", action="store_true")
    deploy = subparsers.add_parser("deploy")
    deploy.add_argument("--tag", required=True)
    deploy.add_argument("--secrets-file")
    deploy.add_argument("--execute", action="store_true")
    secrets = subparsers.add_parser("secrets")
    secrets.add_argument("--worker", default="app")
    secrets.add_argument("--execute", action="store_true")
    args = parser.parse_args()
    try:
        if args.operation == "plan":
            print(json.dumps(asdict(build_plan(args.version, args.ref, args.base, args.pr)), ensure_ascii=False, indent=2))
        elif args.operation == "release":
            require_execute(args)
            require_clean()
            ref = command("git", "rev-parse", f"{args.ref}^{{commit}}")
            if ref != command("git", "rev-parse", "HEAD"):
                raise ValueError("release ref must equal the checked-out HEAD in the dedicated worktree")
            tag = tag_name(args.version)
            if subprocess.run(
                ["git", "rev-parse", "-q", "--verify", f"refs/tags/{tag}"],
                check=False,
                stdout=subprocess.DEVNULL,
            ).returncode == 0:
                raise ValueError(f"tag already exists: {tag}")
            subprocess.run(["git", "tag", "-a", tag, ref, "-m", tag], check=True)
            subprocess.run(["git", "push", "origin", f"refs/tags/{tag}"], check=True)
            print(f"pushed {tag} at {ref}")
        elif args.operation == "secrets":
            require_execute(args)
            client_id = read_secret("GITHUB_CLIENT_ID")
            client_secret = read_secret("GITHUB_CLIENT_SECRET")
            allowed_login = read_secret("GITHUB_ALLOWED_LOGIN")
            session_secret = read_secret("SESSION_SECRET")
            if not client_id or not client_secret or not allowed_login or not session_secret:
                raise ValueError(
                    "GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_ALLOWED_LOGIN and SESSION_SECRET are required"
                )
            apply_secrets(
                args.worker,
                secrets_merge_patch(client_id, client_secret, allowed_login, session_secret),
            )
            print(f"Updated secrets for Worker {args.worker}")
        else:
            require_execute(args)
            require_clean()
            tagged = command("git", "rev-parse", f"{args.tag}^{{commit}}")
            if tagged != command("git", "rev-parse", "HEAD"):
                raise ValueError("checked-out HEAD must equal the deployment tag")
            secrets_file = Path(args.secrets_file) if args.secrets_file else None
            if secrets_file is not None and not secrets_file.is_file():
                raise ValueError(f"secrets file not found: {secrets_file}")
            subprocess.run(
                ["bun", "x", "cf", "d1", "migrations", "list", d1_database_id(), "--dir", "migrations"],
                check=True,
            )
            subprocess.run(deploy_command(secrets_file), check=True)
    except (ValueError, subprocess.CalledProcessError) as error:
        parser.error(str(error))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
