import { describe, expect, it } from "vite-plus/test";
import {
  TASK_TITLE_MAX_CODE_POINTS,
  TASK_DESCRIPTION_MAX_CODE_POINTS,
  applyTaskPatch,
  changeTaskProject,
  changeTaskStatus,
  changeTaskWorking,
  createTask,
  descriptionCodePointLength,
  is_working,
  isTaskProject,
  isTaskOrderValid,
  isTaskStatus,
  isTaskTitleValid,
  isTaskDescriptionValid,
  nextTaskOrder,
  parseTaskPatch,
  parseTaskVersionInputs,
  titleCodePointLength,
} from "../src/task";
import {
  TASK_LIST_PAGE_SIZE,
  filterTasks,
  groupTasksByProject,
  is_do,
  is_done,
  is_skip,
  pageNavItems,
  paginateTasks,
  parseTaskListQuery,
  parsePageParam,
  sortTasksByOrder,
  taskProjectFilter,
  taskTextFilter,
  taskWorkingFilter,
  withQueryToken,
} from "../src/task-list";
import { taskFixture } from "./helpers/task-fixture";

describe("task title validation", () => {
  it("counts Unicode code points", () => {
    expect(titleCodePointLength("a😀")).toBe(2);
  });

  it("INV-TM-005: accepts 1 to 256 Unicode code points", () => {
    expect(isTaskTitleValid("a")).toBe(true);
    expect(isTaskTitleValid("a".repeat(TASK_TITLE_MAX_CODE_POINTS))).toBe(true);
    expect(isTaskTitleValid("😀".repeat(TASK_TITLE_MAX_CODE_POINTS))).toBe(true);

    expect(isTaskTitleValid("")).toBe(false);
    expect(isTaskTitleValid("a".repeat(TASK_TITLE_MAX_CODE_POINTS + 1))).toBe(false);
    expect(isTaskTitleValid("😀".repeat(TASK_TITLE_MAX_CODE_POINTS + 1))).toBe(false);
  });
});

describe("task description validation", () => {
  it("INV-TM-006: accepts empty text through 16,384 Unicode code points", () => {
    expect(descriptionCodePointLength("a😀")).toBe(2);
    expect(isTaskDescriptionValid("")).toBe(true);
    expect(isTaskDescriptionValid("😀".repeat(TASK_DESCRIPTION_MAX_CODE_POINTS))).toBe(true);
    expect(isTaskDescriptionValid("😀".repeat(TASK_DESCRIPTION_MAX_CODE_POINTS + 1))).toBe(false);
  });
});

describe("task enums", () => {
  it("INV-TM-001: recognizes valid status values", () => {
    expect(isTaskStatus("do")).toBe(true);
    expect(isTaskStatus("done")).toBe(true);
    expect(isTaskStatus("skip")).toBe(true);
    expect(isTaskStatus("unknown")).toBe(false);
  });

  it("INV-TM-002: accepts a project id or the unassigned value", () => {
    expect(isTaskProject(null)).toBe(true);
    expect(isTaskProject("Yoriwake")).toBe(true);
    expect(isTaskProject("customer_portal")).toBe(true);
    expect(isTaskProject("Yoriwake!")).toBe(false);
    expect(isTaskProject("")).toBe(false);
    expect(isTaskProject("a".repeat(65))).toBe(false);
    expect(isTaskProject(1)).toBe(false);
  });

  it("accepts only positive safe integer orders", () => {
    expect(isTaskOrderValid(1)).toBe(true);
    expect(isTaskOrderValid(0)).toBe(false);
    expect(isTaskOrderValid(-1)).toBe(false);
    expect(isTaskOrderValid(1.5)).toBe(false);
    expect(isTaskOrderValid(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
  });
});

describe("task filters", () => {
  it("filters tasks by status and supports composing predicates", () => {
    const tasks = [
      taskFixture({ id: "do", status: "do" }),
      taskFixture({ id: "done", status: "done" }),
      taskFixture({ id: "skip", status: "skip" }),
    ];

    expect(filterTasks(tasks, [is_do]).map((task) => task.id)).toEqual(["do"]);
    expect(filterTasks(tasks, [is_done]).map((task) => task.id)).toEqual(["done"]);
    expect(filterTasks(tasks, [is_skip]).map((task) => task.id)).toEqual(["skip"]);
    expect(filterTasks(tasks, [is_do, is_done])).toEqual([]);
  });

  it("recognizes working tasks independently of status", () => {
    expect(is_working(taskFixture({ status: "done", working: true }))).toBe(true);
    expect(is_working(taskFixture({ status: "do", working: false }))).toBe(false);
  });

  it("filters by project, including unassigned tasks", () => {
    const tasks = [
      taskFixture({ id: "yoriwake", project: "Yoriwake" }),
      taskFixture({ id: "dsh", project: "dsh" }),
      taskFixture({ id: "none", project: null }),
    ];

    expect(filterTasks(tasks, [taskProjectFilter("Yoriwake")]).map((task) => task.id)).toEqual(["yoriwake"]);
    expect(filterTasks(tasks, [taskProjectFilter(null)]).map((task) => task.id)).toEqual(["none"]);
  });
});

describe("BDD-TM-003: task list query", () => {
  it("parses status, working, project and free text filters", () => {
    expect(parseTaskListQuery("is:do")).toEqual({
      status: "do",
      working: undefined,
      project: undefined,
      text: [],
    });
    expect(parseTaskListQuery("working:off")).toEqual({
      status: undefined,
      working: "off",
      project: undefined,
      text: [],
    });
    expect(parseTaskListQuery("is:done working:on")).toEqual({
      status: "done",
      working: "on",
      project: undefined,
      text: [],
    });
    expect(parseTaskListQuery("is:do project:Yoriwake")).toEqual({
      status: "do",
      working: undefined,
      project: "Yoriwake",
      text: [],
    });
    expect(parseTaskListQuery("is:do project:none")).toEqual({
      status: "do",
      working: undefined,
      project: null,
      text: [],
    });
  });

  it("parses free text terms and rejects invalid queries", () => {
    expect(parseTaskListQuery("見積もり is:do")).toEqual({
      status: "do",
      working: undefined,
      project: undefined,
      text: ["見積もり"],
    });
    expect(parseTaskListQuery("label:working")).toEqual({
      status: undefined,
      working: undefined,
      project: undefined,
      text: ["label:working"],
    });
    expect(parseTaskListQuery("is:do project:Unknown!")).toBeNull();
    expect(parseTaskListQuery("is:do project:a project:b")).toBeNull();
    expect(parseTaskListQuery("is:do working:on working:off")).toBeNull();
    expect(parseTaskListQuery("is:do working:maybe")).toBeNull();
    expect(parseTaskListQuery("is:issue state:closed")).toBeNull();
  });

});

describe("BDD-TM-003: task list filters", () => {
  it("filters by working state and free text", () => {
    const tasks = [
      taskFixture({ id: "busy", title: "見積もりを送る", working: true }),
      taskFixture({ id: "idle", title: "別の作業", working: false }),
    ];

    expect(filterTasks(tasks, [taskWorkingFilter("on")]).map((task) => task.id)).toEqual(["busy"]);
    expect(filterTasks(tasks, [taskWorkingFilter("off")]).map((task) => task.id)).toEqual(["idle"]);
    expect(filterTasks(tasks, [taskTextFilter("見積もり")]).map((task) => task.id)).toEqual(["busy"]);
    expect(filterTasks(tasks, [taskTextFilter("存在しない")])).toEqual([]);
  });

  it("replaces one filter token without touching the others", () => {
    expect(withQueryToken("is:do project:Yoriwake working:on", "project:", "project:dsh")).toBe(
      "is:do working:on project:dsh",
    );
    expect(withQueryToken("is:do project:Yoriwake", "project:", null)).toBe("is:do");
    expect(withQueryToken("is:do", "working:", "working:on")).toBe("is:do working:on");
    expect(withQueryToken("is:do working:on", "working:", null)).toBe("is:do");
  });
});

describe("BDD-TM-006: DS project grouping", () => {
  it("orders groups by sort_order with unassigned tasks last", () => {
    const projects = [
      { id: "b", name: "b", path: null, sort_order: 2, archived: false },
      { id: "a", name: "a", path: null, sort_order: 1, archived: false },
    ];
    const tasks = [
      taskFixture({ id: "none", project: null }),
      taskFixture({ id: "b-1", project: "b" }),
      taskFixture({ id: "a-1", project: "a" }),
      taskFixture({ id: "ghost", project: "missing" }),
    ];

    const groups = groupTasksByProject(tasks, projects);

    expect(groups.map((group) => group.project?.id ?? null)).toEqual(["a", "b", null]);
    expect(groups[2]?.tasks.map((task) => task.id)).toEqual(["none", "ghost"]);
  });
});

describe("sortTasksByOrder", () => {
  it("sorts tasks by order and breaks ties by id without mutating the input", () => {
    const tasks = [
      taskFixture({ id: "c", order: 3 }),
      taskFixture({ id: "b", order: 1 }),
      taskFixture({ id: "a", order: 1 }),
    ];

    const sorted = sortTasksByOrder(tasks);

    expect(sorted.map((task) => task.id)).toEqual(["a", "b", "c"]);
    expect(tasks.map((task) => task.id)).toEqual(["c", "b", "a"]);
  });
});

describe("bulk task input", () => {
  it("accepts unique task ids with positive integer versions", () => {
    expect(
      parseTaskVersionInputs([
        { id: "task-1", version: 1 },
        { id: "task-2", version: 2 },
      ]),
    ).toEqual({
      ok: true,
      value: [
        { id: "task-1", version: 1 },
        { id: "task-2", version: 2 },
      ],
    });
  });

  it("rejects empty, duplicate, and invalid inputs", () => {
    expect(parseTaskVersionInputs([]).ok).toBe(false);
    expect(
      parseTaskVersionInputs([
        { id: "task-1", version: 1 },
        { id: "task-1", version: 1 },
      ]).ok,
    ).toBe(false);
    expect(parseTaskVersionInputs([{ id: "task-1", version: 0 }]).ok).toBe(false);
  });
});

describe("task domain", () => {
  it("creates a task and rejects an invalid title", () => {
    const created = createTask({
      id: "task-1",
      owner_id: "owner-1",
      title: "Buy milk",
      description: "",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });

    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.status).toBe("do");
    expect(created.value.project).toBeNull();
    expect(created.value.order).toBe(1);
    expect(created.value.version).toBe(1);
    expect(created.value.id).toBe("task-1");
    expect(created.value.created_at).toBe("2026-01-01T00:00:00.000Z");
    expect(created.value.updated_at).toBe("2026-01-01T00:00:00.000Z");

    const invalid = createTask({
      id: "task-2",
      owner_id: "owner-1",
      title: "",
      description: "",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.error.code).toBe("INVALID_TITLE");
    }
  });

  it("creates a task with the given project", () => {
    const created = createTask({
      id: "task-1",
      owner_id: "owner-1",
      title: "Buy milk",
      description: "",
      project: "Yoriwake",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });

    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.project).toBe("Yoriwake");
  });
});

describe("task status and project", () => {
  it("INV-TM-002: keeps project when status changes", () => {
    const task = taskFixture({ id: "task-1", project: "Yoriwake" });

    const done = changeTaskStatus(task, "done");
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.value.project).toBe("Yoriwake");
    expect(done.value.status).toBe("done");
  });

  it("changes project without changing status", () => {
    const task = taskFixture({ id: "task-1", status: "do" });

    const changed = changeTaskProject(task, "dsh");
    expect(changed.ok).toBe(true);
    if (!changed.ok) return;
    expect(changed.value.project).toBe("dsh");
    expect(changed.value.status).toBe("do");

    const cleared = changeTaskProject(task, null);
    expect(cleared.ok).toBe(true);
    if (!cleared.ok) return;
    expect(cleared.value.project).toBeNull();
  });

  it("INV-TM-003: toggles working without changing status or project", () => {
    const task = taskFixture({ id: "task-1", status: "do", project: "dsh", working: false });

    const started = changeTaskWorking(task, true);
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.value.working).toBe(true);
    expect(started.value.status).toBe("do");
    expect(started.value.project).toBe("dsh");
  });
});

describe("task working preservation", () => {
  it("keeps working when status changes to done", () => {
    const task = taskFixture({ id: "task-1", status: "do", working: true });

    const done = changeTaskStatus(task, "done");
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.value.status).toBe("done");
    expect(done.value.working).toBe(true);
  });
});

describe("task order", () => {
  it("INV-TM-004: numbers the next order after the whole task list", () => {
    const tasks = [
      taskFixture({ id: "a1", order: 1 }),
      taskFixture({ id: "a2", order: 4 }),
      taskFixture({ id: "b1", order: 9 }),
    ];

    expect(nextTaskOrder(tasks)).toBe(10);
    expect(nextTaskOrder([])).toBe(1);
  });
});

describe("task patch", () => {
  it("parses provided fields and trims the title", () => {
    expect(parseTaskPatch({ title: "  Buy milk  ", status: "done" })).toEqual({
      ok: true,
      value: { title: "Buy milk", status: "done" },
    });
  });

  it("rejects invalid enum, project and working values", () => {
    expect(parseTaskPatch({ status: "unknown" })).toEqual({
      ok: false,
      error: { code: "INVALID_STATUS" },
    });
    expect(parseTaskPatch({ project: "Yoriwake!" })).toEqual({
      ok: false,
      error: { code: "INVALID_PROJECT" },
    });
    expect(parseTaskPatch({ working: "yes" })).toEqual({
      ok: false,
      error: { code: "INVALID_WORKING" },
    });
  });

  it("ignores non-string title and description values", () => {
    expect(parseTaskPatch({ title: 1, description: null })).toEqual({ ok: true, value: {} });
  });

  it("applies a patch without touching other fields", () => {
    const task = taskFixture({ id: "task-1", title: "before", status: "do", project: null });

    expect(applyTaskPatch(task, { status: "done", project: "dsh" })).toMatchObject({
      id: "task-1",
      title: "before",
      status: "done",
      project: "dsh",
    });
  });

  it("clears the project with an explicit null", () => {
    expect(parseTaskPatch({ project: null })).toEqual({ ok: true, value: { project: null } });
  });
});

describe("task list pagination", () => {
  it("fixes the page size to 25", () => {
    expect(TASK_LIST_PAGE_SIZE).toBe(25);
  });

  it("parses only positive integer page params", () => {
    expect(parsePageParam("1")).toBe(1);
    expect(parsePageParam("2")).toBe(2);

    expect(parsePageParam(null)).toBeNull();
    expect(parsePageParam(undefined)).toBeNull();
    expect(parsePageParam("")).toBeNull();
    expect(parsePageParam("0")).toBeNull();
    expect(parsePageParam("-1")).toBeNull();
    expect(parsePageParam("1.5")).toBeNull();
    expect(parsePageParam("abc")).toBeNull();
    expect(parsePageParam("1abc")).toBeNull();
    expect(parsePageParam(2)).toBeNull();
  });

  it("slices 25 items per page and clamps out-of-range pages", () => {
    const tasks = Array.from({ length: 26 }, (_, index) =>
      taskFixture({ id: `task-${index + 1}` }),
    );

    const first = paginateTasks(tasks, 1);
    expect(first.currentPage).toBe(1);
    expect(first.totalPages).toBe(2);
    expect(first.pageTasks.map((task) => task.id)).toEqual(
      tasks.slice(0, 25).map((task) => task.id),
    );

    const second = paginateTasks(tasks, 2);
    expect(second.currentPage).toBe(2);
    expect(second.pageTasks.map((task) => task.id)).toEqual(["task-26"]);

    const overflow = paginateTasks(tasks, 99);
    expect(overflow.currentPage).toBe(2);
    expect(overflow.pageTasks.map((task) => task.id)).toEqual(["task-26"]);

    const below = paginateTasks(tasks, 0);
    expect(below.currentPage).toBe(1);
    expect(below.pageTasks).toHaveLength(25);
  });

  it("keeps a single page for 25 or fewer items", () => {
    expect(paginateTasks([], 1).totalPages).toBe(1);
    expect(paginateTasks(Array.from({ length: 25 }, (_, index) => taskFixture({ id: `t-${index}` })), 3).currentPage).toBe(1);
  });

  it("keeps the first and last pages and collapses gaps", () => {
    expect(pageNavItems(1, 1)).toEqual([1]);
    expect(pageNavItems(1, 2)).toEqual([1, 2]);
    expect(pageNavItems(2, 3)).toEqual([1, 2, 3]);
    expect(pageNavItems(1, 10)).toEqual([1, 2, "ellipsis", 10]);
    expect(pageNavItems(5, 10)).toEqual([1, "ellipsis", 4, 5, 6, "ellipsis", 10]);
    expect(pageNavItems(10, 10)).toEqual([1, "ellipsis", 9, 10]);
  });
});
