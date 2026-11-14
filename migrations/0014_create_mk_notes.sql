CREATE TABLE IF NOT EXISTS mk_notes (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 256),
  body TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT 'default' CHECK (color IN ('default', 'red', 'orange', 'yellow', 'green', 'blue', 'purple')),
  pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS mk_notes_owner_pinned_updated_idx ON mk_notes (owner_id, pinned, updated_at);
