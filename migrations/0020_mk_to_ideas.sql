-- Ideas（旧）を削除し、MK のメモ / 画像を Ideas に rename する。
-- 旧 Ideas のデータは事前に MK 側へ取り込み済み。
DROP TABLE IF EXISTS ideas;

ALTER TABLE mk_notes RENAME TO ideas;
ALTER TABLE mk_images RENAME TO idea_images;

-- SQLite の RENAME では index 名が変わらないため、Ideas の名前で貼り直す。
DROP INDEX IF EXISTS mk_notes_owner_pinned_updated_idx;
DROP INDEX IF EXISTS mk_notes_owner_archived_updated_idx;
DROP INDEX IF EXISTS mk_notes_owner_deleted_updated_idx;
DROP INDEX IF EXISTS mk_images_note_position_idx;

CREATE INDEX IF NOT EXISTS ideas_owner_pinned_updated_idx ON ideas (owner_id, pinned, updated_at);
CREATE INDEX IF NOT EXISTS ideas_owner_archived_updated_idx ON ideas (owner_id, archived_at, updated_at);
CREATE INDEX IF NOT EXISTS ideas_owner_deleted_updated_idx ON ideas (owner_id, deleted_at, updated_at);
CREATE INDEX IF NOT EXISTS idea_images_note_position_idx ON idea_images (note_id, position);
