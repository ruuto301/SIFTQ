-- Migration number: 0009
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0
);

INSERT INTO projects (id, name, path, sort_order, archived) VALUES
  ('Yoriwake', 'Yoriwake', '/mnt/c/projects/Yoriwake', 1, 0),
  ('dsh', 'dsh', '/mnt/c/projects/dsh', 2, 0),
  ('customer_portal', 'customer_portal', NULL, 3, 0),
  ('affiliate', 'affiliate', NULL, 4, 0),
  ('kits', 'kits', NULL, 5, 0),
  ('scripts', 'scripts', NULL, 6, 0);
