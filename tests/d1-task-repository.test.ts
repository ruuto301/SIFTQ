import { describe, expect, it } from "vite-plus/test";
import { TASK_COLUMN_NAMES, toTask } from "../src/repository/d1-task-repository";
import type { Task } from "../src/task";

const SAMPLE_TASK: Task = {
  id: "task-1",
  owner_id: "local",
  title: "title",
  description: "description",
  status: "do",
  working: true,
  area: 2,
  order: 3,
  version: 1,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z",
};

const SAMPLE_ROW = {
  id: "task-1",
  owner_id: "local",
  title: "title",
  description: "description",
  status: "do",
  working: 1,
  area: 2,
  order: 3,
  version: 1,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z",
};

function columnField(column: string): string {
  return column.replaceAll('"', "");
}

describe("D1 task column list", () => {
  it("maps a stored row to a Task", () => {
    expect(toTask(SAMPLE_ROW)).toEqual(SAMPLE_TASK);
  });

  it("covers exactly the Task fields", () => {
    const columns = TASK_COLUMN_NAMES.map(columnField).sort();
    expect(columns).toEqual(Object.keys(SAMPLE_TASK).sort());
  });
});
