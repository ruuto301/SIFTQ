"""Documentation coverage for encrypted session backup."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ADR = ROOT / "docs/adr/0076-back-up-dsh-sessions-with-age.md"
ADR_INDEX = ROOT / "docs/adr/README.md"
DOC = ROOT / "docs/contributing/session-backup.md"


def test_adr_is_indexed() -> None:
    assert ADR.is_file()
    assert ADR.name in ADR_INDEX.read_text(encoding="utf-8")


def test_adr_records_encryption_and_manual_operation() -> None:
    text = ADR.read_text(encoding="utf-8")
    assert "age" in text
    assert "X25519" in text
    assert "手動" in text


def test_session_backup_doc_covers_required_topics() -> None:
    text = DOC.read_text(encoding="utf-8")
    assert ".taqt/session-backup/recipient.pub" in text
    assert "AGE_IDENTITY_FILE" in text
    assert "session:backup" in text
    assert "session:restore" in text
    assert "sessions/dsh/" in text
    assert "git 履歴" in text
    assert "--dsh-home" in text
