"""Encrypted session backup for the public repository.

Codex sessions are backed up file by file: every ``*.jsonl`` under the Codex
sessions root becomes ``sessions/codex/<YYYY>/<MM>/<DD>/<name>.jsonl.zst.age``.
DeepSeek Harness sessions are backed up file by file from
``$DSH_HOME/sessions`` to ``sessions/dsh/<relative path>.zst.age``. Both are
zstd-compressed and age-encrypted (X25519). The private identity is never read
here; only the recipient public key is tracked.
"""

import argparse
import os
import re
import shutil
import subprocess
import tempfile
from collections.abc import Mapping, Sequence
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT_ROOT = REPOSITORY_ROOT / "sessions"
DEFAULT_RECIPIENT_FILE = REPOSITORY_ROOT / ".taqt" / "session-backup" / "recipient.pub"

# Keep encrypted parts below GitHub's 100MiB per-file push limit with headroom.
DEFAULT_PART_SIZE = 90 * 1024 * 1024


def default_identity_file() -> Path:
    return Path.home() / ".config" / "age" / "session.key"


def resolve_identity(env: Mapping[str, str] | None = None) -> Path | str:
    """Resolve the age identity used to decrypt backups.

    ``AGE_IDENTITY_FILE`` (path to a key file) wins over ``AGE_IDENTITY``
    (inline key material), which wins over ``~/.config/age/session.key``.
    A ``Path`` result is a file reference; a ``str`` result is inline material.
    """
    values = os.environ if env is None else env
    identity_file = values.get("AGE_IDENTITY_FILE")
    if identity_file:
        return Path(identity_file)
    identity = values.get("AGE_IDENTITY")
    if identity:
        return identity
    return default_identity_file()


def codex_home() -> Path:
    override = os.environ.get("CODEX_HOME")
    return Path(override) if override else Path.home() / ".codex"


def codex_sessions_root(codex_home_dir: Path | None = None) -> Path:
    return (codex_home_dir or codex_home()) / "sessions"


def codex_session_files(sessions_root: Path) -> list[Path]:
    return sorted(path for path in sessions_root.rglob("*.jsonl") if path.is_file())


def codex_backup_path(sessions_root: Path, source: Path, output_root: Path) -> Path:
    relative = source.relative_to(sessions_root)
    return output_root / "codex" / relative.parent / f"{relative.name}.zst.age"


def require_tool(name: str) -> str:
    path = shutil.which(name)
    if path is None:
        raise SystemExit(f"{name} is required; run 'task setup:aqua'")
    return path


def part_path(target: Path, index: int) -> Path:
    return target.with_name(f"{target.name}.part-{index:03d}")


def split_file(source: Path, target: Path, part_size: int) -> list[Path]:
    """Move ``source`` to ``target``, or split it into ``target.part-NNN`` files.

    Each part is at most ``part_size`` bytes. Stale parts from a previous,
    larger split are removed so a re-run never leaves orphaned ciphertext.
    """
    target.parent.mkdir(parents=True, exist_ok=True)
    for stale in target.parent.glob(f"{target.name}.part-*"):
        stale.unlink()
    target.unlink(missing_ok=True)
    if source.stat().st_size <= part_size:
        source.replace(target)
        return [target]
    parts: list[Path] = []
    with source.open("rb") as handle:
        while chunk := handle.read(part_size):
            part = part_path(target, len(parts))
            part.write_bytes(chunk)
            parts.append(part)
    source.unlink(missing_ok=True)
    return parts


def compress_encrypt(
    source: Path,
    target: Path,
    recipient_file: Path,
    part_size: int = DEFAULT_PART_SIZE,
) -> list[Path]:
    """zstd-compress and age-encrypt ``source`` into ``target``.

    Returns the written files: ``[target]`` when the ciphertext fits
    ``part_size``, otherwise the ``target.part-NNN`` pieces.
    """
    zstd = require_tool("zstd")
    age = require_tool("age")
    target.parent.mkdir(parents=True, exist_ok=True)
    compressed = target.with_name(target.name + ".zst.tmp")
    temporary = target.with_name(target.name + ".tmp")
    try:
        subprocess.run(
            [zstd, "-q", "-f", str(source), "-o", str(compressed)],
            check=True,
        )
        subprocess.run(
            [age, "-R", str(recipient_file), "-o", str(temporary), str(compressed)],
            check=True,
        )
        return split_file(temporary, target, part_size)
    finally:
        compressed.unlink(missing_ok=True)
        temporary.unlink(missing_ok=True)


def existing_archive(target: Path) -> list[Path]:
    """Return the archive written for ``target``, whether single or split."""
    if target.exists():
        return [target]
    return sorted(target.parent.glob(f"{target.name}.part-*"))


_PART_SUFFIX = re.compile(r"\.part-\d+$")


def archive_target(path: Path) -> Path:
    """Map a split part (``....part-NNN``) back to its unsplit archive path."""
    return path.with_name(_PART_SUFFIX.sub("", path.name))


def backup_codex(
    *,
    sessions_root: Path,
    output_root: Path = DEFAULT_OUTPUT_ROOT,
    recipient_file: Path = DEFAULT_RECIPIENT_FILE,
    part_size: int = DEFAULT_PART_SIZE,
) -> list[Path]:
    if not sessions_root.is_dir():
        raise SystemExit(f"codex sessions root not found: {sessions_root}")
    if not recipient_file.is_file():
        raise SystemExit(f"age recipient file not found: {recipient_file}")

    created: list[Path] = []
    for source in codex_session_files(sessions_root):
        target = codex_backup_path(sessions_root, source, output_root)
        existing = existing_archive(target)
        if (
            existing
            and min(path.stat().st_mtime for path in existing) >= source.stat().st_mtime
        ):
            continue
        created.extend(compress_encrypt(source, target, recipient_file, part_size))
    return created


def dsh_home(override: Path | None = None) -> Path:
    if override is not None:
        return override
    env = os.environ.get("DSH_HOME")
    return Path(env) if env else Path.home() / ".dsh"


def dsh_sessions_root(dsh_home_dir: Path | None = None) -> Path:
    return (dsh_home_dir or dsh_home()) / "sessions"


def dsh_session_files(sessions_root: Path) -> list[Path]:
    patterns = ("session*.jsonl", "session*.jsonl.zst")
    files: set[Path] = set()
    for pattern in patterns:
        files.update(
            path for path in sessions_root.rglob(pattern) if path.is_file()
        )
    return sorted(files)


def dsh_backup_path(sessions_root: Path, source: Path, output_root: Path) -> Path:
    relative = source.relative_to(sessions_root)
    return output_root / "dsh" / relative.parent / f"{relative.name}.zst.age"


def backup_dsh(
    *,
    sessions_root: Path,
    output_root: Path = DEFAULT_OUTPUT_ROOT,
    recipient_file: Path = DEFAULT_RECIPIENT_FILE,
    part_size: int = DEFAULT_PART_SIZE,
) -> list[Path]:
    if not sessions_root.is_dir():
        raise SystemExit(f"dsh sessions root not found: {sessions_root}")
    if not recipient_file.is_file():
        raise SystemExit(f"age recipient file not found: {recipient_file}")

    created: list[Path] = []
    for source in dsh_session_files(sessions_root):
        target = dsh_backup_path(sessions_root, source, output_root)
        existing = existing_archive(target)
        if (
            existing
            and min(path.stat().st_mtime for path in existing) >= source.stat().st_mtime
        ):
            continue
        created.extend(compress_encrypt(source, target, recipient_file, part_size))
    return created


def decompress_decrypt(
    sources: Sequence[Path], target: Path, identity: Path | str
) -> None:
    age = require_tool("age")
    zstd = require_tool("zstd")
    target.parent.mkdir(parents=True, exist_ok=True)
    compressed = target.with_name(target.name + ".zst.tmp")
    temporary = target.with_name(target.name + ".tmp")
    joined = target.with_name(target.name + ".cipher.tmp")
    temporary_identity: Path | None = None
    try:
        if len(sources) == 1:
            ciphertext = sources[0]
        else:
            with joined.open("wb") as output:
                for part in sources:
                    with part.open("rb") as handle:
                        shutil.copyfileobj(handle, output)
            ciphertext = joined
        if isinstance(identity, str):
            handle = tempfile.NamedTemporaryFile("w", delete=False)
            handle.write(identity if identity.endswith("\n") else identity + "\n")
            handle.close()
            temporary_identity = Path(handle.name)
            temporary_identity.chmod(0o600)
            identity_path = temporary_identity
        else:
            identity_path = identity
        subprocess.run(
            [age, "-d", "-i", str(identity_path), "-o", str(compressed), str(ciphertext)],
            check=True,
        )
        subprocess.run(
            [zstd, "-d", "-q", "-f", str(compressed), "-o", str(temporary)],
            check=True,
        )
        temporary.replace(target)
    finally:
        compressed.unlink(missing_ok=True)
        temporary.unlink(missing_ok=True)
        joined.unlink(missing_ok=True)
        if temporary_identity is not None:
            temporary_identity.unlink(missing_ok=True)


def codex_restore_path(backup_root: Path, source: Path, sessions_root: Path) -> Path:
    relative = source.relative_to(backup_root / "codex")
    name = relative.name[: -len(".zst.age")]
    return sessions_root / relative.parent / name


def restore_codex(
    *,
    backup_root: Path = DEFAULT_OUTPUT_ROOT,
    sessions_root: Path,
    identity: Path | str,
) -> list[Path]:
    codex_root = backup_root / "codex"
    targets = sorted(
        {
            archive_target(path)
            for path in codex_root.rglob("*")
            if path.is_file() and ".zst.age" in path.name
        }
    )
    restored: list[Path] = []
    for target in targets:
        sources = existing_archive(target)
        if not sources:
            continue
        destination = codex_restore_path(backup_root, target, sessions_root)
        decompress_decrypt(sources, destination, identity)
        restored.append(destination)
    return restored


def dsh_restore_path(backup_root: Path, source: Path, sessions_root: Path) -> Path:
    relative = source.relative_to(backup_root / "dsh")
    name = relative.name[: -len(".zst.age")]
    return sessions_root / relative.parent / name


def restore_dsh(
    *,
    backup_root: Path = DEFAULT_OUTPUT_ROOT,
    sessions_root: Path,
    identity: Path | str,
) -> list[Path]:
    dsh_root = backup_root / "dsh"
    targets = sorted(
        {
            archive_target(path)
            for path in dsh_root.rglob("*")
            if path.is_file() and ".zst.age" in path.name
        }
    )
    restored: list[Path] = []
    for target in targets:
        sources = existing_archive(target)
        if not sources:
            continue
        destination = dsh_restore_path(backup_root, target, sessions_root)
        decompress_decrypt(sources, destination, identity)
        restored.append(destination)
    return restored


def add_target_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--codex-home", type=Path)
    parser.add_argument("--sessions-root", type=Path)
    parser.add_argument("--dsh-home", type=Path)
    parser.add_argument(
        "--only",
        choices=("codex", "dsh", "all"),
        default="all",
        help="Limit the command to one session source (default: all).",
    )


def run_backup(args: argparse.Namespace) -> int:
    if args.only in ("codex", "all"):
        sessions_root = args.sessions_root or codex_sessions_root(args.codex_home)
        for path in backup_codex(
            sessions_root=sessions_root,
            output_root=args.output_root,
            recipient_file=args.recipient,
        ):
            print(path)
    if args.only in ("dsh", "all"):
        sessions_root = dsh_sessions_root(args.dsh_home)
        for path in backup_dsh(
            sessions_root=sessions_root,
            output_root=args.output_root,
            recipient_file=args.recipient,
        ):
            print(path)
    return 0


def run_restore(args: argparse.Namespace) -> int:
    identity: Path | str
    if args.identity_file is not None:
        identity = args.identity_file
    elif args.identity is not None:
        identity = args.identity
    else:
        identity = resolve_identity()
    if args.only in ("codex", "all"):
        sessions_root = args.sessions_root or codex_sessions_root(args.codex_home)
        for path in restore_codex(
            backup_root=args.backup_root,
            sessions_root=sessions_root,
            identity=identity,
        ):
            print(path)
    if args.only in ("dsh", "all"):
        sessions_root = dsh_sessions_root(args.dsh_home)
        for path in restore_dsh(
            backup_root=args.backup_root,
            sessions_root=sessions_root,
            identity=identity,
        ):
            print(path)
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    backup = subparsers.add_parser("backup", help="Encrypt sessions into the backup root.")
    add_target_arguments(backup)
    backup.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    backup.add_argument("--recipient", type=Path, default=DEFAULT_RECIPIENT_FILE)
    backup.set_defaults(handler=run_backup)

    restore = subparsers.add_parser(
        "restore", help="Decrypt backups from the backup root."
    )
    add_target_arguments(restore)
    restore.add_argument("--backup-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    restore.add_argument("--identity-file", type=Path)
    restore.add_argument("--identity")
    restore.set_defaults(handler=run_restore)

    args = parser.parse_args(argv)
    return args.handler(args)


if __name__ == "__main__":
    raise SystemExit(main())
