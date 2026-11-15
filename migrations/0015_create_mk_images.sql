CREATE TABLE IF NOT EXISTS mk_images (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  image_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 1),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS mk_images_note_position_idx ON mk_images (note_id, position);
