-- Migration number: 0008
ALTER TABLE tasks ADD COLUMN project TEXT;
CREATE INDEX IF NOT EXISTS tasks_project_idx ON tasks (project);
