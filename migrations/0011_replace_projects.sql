-- Migration number: 0011
-- Reassign tasks of removed projects to 未分類 so the delete is always safe.
UPDATE tasks SET project = NULL WHERE project IN ('dsh', 'kits', 'scripts');

DELETE FROM projects WHERE id IN ('dsh', 'kits', 'scripts');

UPDATE projects SET sort_order = 1 WHERE id = 'Yoriwake';
UPDATE projects SET sort_order = 2 WHERE id = 'affiliate';
UPDATE projects SET sort_order = 3 WHERE id = 'customer_portal';

INSERT INTO projects (id, name, path, sort_order, archived) VALUES
  ('life', '生活', NULL, 4, 0);
