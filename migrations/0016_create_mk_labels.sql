CREATE TABLE IF NOT EXISTS mk_labels (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS mk_labels_owner_name_idx ON mk_labels (owner_id, name);

CREATE TABLE IF NOT EXISTS mk_note_labels (
  note_id TEXT NOT NULL,
  label_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  PRIMARY KEY (note_id, label_id)
);

CREATE INDEX IF NOT EXISTS mk_note_labels_owner_label_idx ON mk_note_labels (owner_id, label_id);
