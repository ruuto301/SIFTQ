ALTER TABLE mk_notes ADD COLUMN archived_at TEXT;
ALTER TABLE mk_notes ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS mk_notes_owner_archived_updated_idx ON mk_notes (owner_id, archived_at, updated_at);
CREATE INDEX IF NOT EXISTS mk_notes_owner_deleted_updated_idx ON mk_notes (owner_id, deleted_at, updated_at);
