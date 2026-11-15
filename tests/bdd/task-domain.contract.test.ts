import { describe, expect, it } from "vite-plus/test";
import {
  changeTaskProject,
  changeTaskStatus,
  createTask,
} from "../../src/task";
import type { Task } from "../../src/task";
import { filterTasks, taskProjectFilter } from "../../src/task-list";
import { taskFixture } from "../helpers/task-fixture";

describe("BDD-TM-001: domain task creation", () => {
  it("creates a task with display and edit attributes", () => {
    const result = createTask({
      id: "task-1",
      owner_id: "owner-1",
      title: "Buy milk",
      description: "low-fat",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.title).toBe("Buy milk");
    expect(result.value.description).toBe("low-fat");
    expect(result.value.status).toBe("do");
    expect(result.value.project).toBeNull();
    expect(result.value.order).toBe(1);
    expect(result.value.version).toBe(1);
    expect(result.value.id).toBe("task-1");
    expect(result.value.created_at).toBe("2026-01-01T00:00:00.000Z");
    expect(result.value.updated_at).toBe("2026-01-01T00:00:00.000Z");
    expect(result.value.owner_id).toBe("owner-1");
  });

  it("returns expected validation failures as Result errors", () => {
    const invalidTitle = createTask({
      id: "task-1",
      owner_id: "owner-1",
      title: "",
      description: "",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });

    expect(invalidTitle).toEqual({ ok: false, error: { code: "INVALID_TITLE" } });
  });

});

describe("INV-TM-006: description validation", () => {
  it("accepts empty descriptions and rejects oversized descriptions", () => {
    const empty = createTask({
      id: "task-empty-description",
      owner_id: "owner-1",
      title: "Buy milk",
      description: "",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    expect(empty.ok).toBe(true);

    const oversized = createTask({
      id: "task-oversized-description",
      owner_id: "owner-1",
      title: "Buy milk",
      description: "😀".repeat(16_385),
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    expect(oversized).toEqual({ ok: false, error: { code: "INVALID_DESCRIPTION" } });
  });
});

describe("BDD-TM-002: domain project assignment", () => {
  it("keeps one project per task and allows clearing it", () => {
    const task = taskFixture({ id: "task-1", project: null });

    const assigned = changeTaskProject(task, "Yoriwake");
    expect(assigned.ok).toBe(true);
    if (!assigned.ok) return;
    expect(assigned.value.project).toBe("Yoriwake");

    const reassigned = changeTaskProject(assigned.value, "dsh");
    expect(reassigned.ok).toBe(true);
    if (!reassigned.ok) return;
    expect(reassigned.value.project).toBe("dsh");

    const cleared = changeTaskProject(reassigned.value, null);
    expect(cleared.ok).toBe(true);
    if (!cleared.ok) return;
    expect(cleared.value.project).toBeNull();
  });
});

describe("BDD-TM-007: status change preserves project", () => {
  it("keeps the project when a task is completed or skipped", () => {
    const task = taskFixture({ id: "task-1", project: "Yoriwake" });

    const done = changeTaskStatus(task, "done");
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.value.project).toBe("Yoriwake");

    const backToDo = changeTaskStatus(done.value, "do");
    expect(backToDo.ok).toBe(true);
    if (!backToDo.ok) return;
    expect(backToDo.value.project).toBe("Yoriwake");
  });
});

describe("project extraction", () => {
  it("keeps only the requested project", () => {
    const tasks: readonly Task[] = [
      taskFixture({ id: "yoriwake", status: "do", project: "Yoriwake" }),
      taskFixture({ id: "dsh", status: "do", project: "dsh" }),
      taskFixture({ id: "none", status: "do", project: null }),
    ];

    expect(filterTasks(tasks, [taskProjectFilter("Yoriwake")]).map((task) => task.id)).toEqual([
      "yoriwake",
    ]);
    expect(filterTasks(tasks, [taskProjectFilter(null)]).map((task) => task.id)).toEqual(["none"]);
  });
});
