import { describe, expect, it } from "vite-plus/test";
import { PREVIEW_TASKS } from "../src/preview/tasks";
import { TASK_LIST_PAGE_SIZE } from "../src/task-list";

describe("PREVIEW_TASKS", () => {
  it("keeps the seed scenario covering all task states and projects first", () => {
    expect(PREVIEW_TASKS.slice(0, 4).map((task) => task.status)).toEqual([
      "do",
      "do",
      "done",
      "skip",
    ]);
    expect(PREVIEW_TASKS.slice(0, 4).map((task) => task.project)).toEqual([
      "Yoriwake",
      "dsh",
      "customer_portal",
      null,
    ]);
  });

  it("provides at least three list pages per status", () => {
    for (const status of ["do", "done", "skip"] as const) {
      const count = PREVIEW_TASKS.filter((task) => task.status === status).length;
      expect(count).toBeGreaterThan(TASK_LIST_PAGE_SIZE * 2);
    }
  });

  it("assigns every project id to an existing preview project", () => {
    const ids = new Set(["Yoriwake", "dsh", "customer_portal"]);
    for (const task of PREVIEW_TASKS) {
      if (task.project !== null) expect(ids.has(task.project)).toBe(true);
    }
  });
});
