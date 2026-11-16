-- Ideas の添付（画像・ファイル）を R2 に保存し、メタデータをここで管理する。
-- 既存 idea_images（D1 BLOB、画像のみ・1MB 上限）は表示用にそのまま残す。
CREATE TABLE IF NOT EXISTS idea_attachments (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  note_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  preview TEXT NOT NULL DEFAULT 'inline',
  created_at TEXT NOT NULL,
  deleted_at TEXT NULL
);

CREATE INDEX IF NOT EXISTS idea_attachments_note_position_idx ON idea_attachments (note_id, position);
CREATE INDEX IF NOT EXISTS idea_attachments_owner_created_idx ON idea_attachments (owner_id, created_at DESC);
