// covers: BDD-TM-016, BDD-TM-019
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { authenticatedRequest } from "../helpers/authenticated-request";
import { taskFixture } from "../helpers/task-fixture";
import { createMemoryTaskRepository } from "../helpers/memory-task-repository";
import type { TaskRepository } from "../../src/repository/task-repository";

let repo: TaskRepository;

beforeEach(() => {
  repo = createMemoryTaskRepository();
});

function request(path: string, init?: RequestInit) {
  return authenticatedRequest(path, repo, init);
}

async function seedDoTasks(count: number) {
  for (let index = 1; index <= count; index += 1) {
    const id = `seed-${String(index).padStart(3, "0")}`;
    await repo.insert(taskFixture({ id, title: `seed title ${index}`, status: "do" }));
  }
}

function countTaskRows(body: string): number {
  return body.split('class="task-row"').length - 1;
}

describe("Task list page", () => {
  it("defaults to do and renders status filter controls", async () => {
    await repo.insert(taskFixture({ id: "do-1", status: "do" }));
    await repo.insert(taskFixture({ id: "done-1", status: "done" }));
    await repo.insert(taskFixture({ id: "skip-1", status: "skip" }));

    const response = await request("/tasks");
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("do-1");
    expect(body).not.toContain("done-1");
    expect(body).not.toContain("skip-1");
    expect(body).toContain('aria-label="Filter tasks by status"');
    expect(body).toContain('aria-current="true" href="/tasks?status=do"');
    expect(body).toContain('href="/tasks?status=done"');
    expect(body).toContain('href="/tasks?status=skip"');
    expect(body).toContain('name="q"');
    expect(body).toContain('value="is:do"');
    expect(body).toContain("Submit search");
    expect(body).toContain('placeholder="見積もり is:do project:Yoriwake working:on"');
  });

  it.each(["do", "done", "skip"] as const)("filters tasks by %s status", async (status) => {
    await repo.insert(taskFixture({ id: "do-1", status: "do" }));
    await repo.insert(taskFixture({ id: "done-1", status: "done" }));
    await repo.insert(taskFixture({ id: "skip-1", status: "skip" }));

    const body = await (await request(`/tasks?status=${status}`)).text();

    for (const candidate of ["do", "done", "skip"] as const) {
      const id = `${candidate}-1`;
      if (candidate === status) {
        expect(body).toContain(id);
      } else {
        expect(body).not.toContain(id);
      }
    }
    expect(body).toContain(`aria-current="true" href="/tasks?status=${status}"`);
  });

  it("falls back to do for an unknown status and displays an empty-state message", async () => {
    await repo.insert(taskFixture({ id: "done-1", status: "done" }));

    const fallbackBody = await (await request("/tasks?status=unknown")).text();
    expect(fallbackBody).toContain('aria-current="true" href="/tasks?status=do"');
    expect(fallbackBody).not.toContain("done-1");

    const emptyBody = await (await request("/tasks?status=skip")).text();
    expect(emptyBody).toContain("該当するtaskはありません。");
  });

  it("renders compact issues-like rows with project and status badges", async () => {
    await repo.insert(taskFixture({ id: "task-1", status: "do", project: "Yoriwake" }));

    const body = await (await request("/tasks")).text();

    expect(body).toContain('class="task-row"');
    expect(body).not.toContain("issue-number");
    expect(body).toContain("seed task");
    expect(body).toContain("label label--project");
    expect(body).toContain("#Yoriwake");
    expect(body).toContain("status--do");
    expect(body).toContain('data-version="1"');
    expect(body).toContain('data-task-select');
  });

});

describe("Task list project label", () => {
  it("renders 未分類 for a task without a project", async () => {
    await repo.insert(taskFixture({ id: "task-1", status: "do", project: null }));

    const body = await (await request("/tasks")).text();

    expect(body).toContain("label--project-none");
    expect(body).toContain("未分類");
  });
});

describe("Task list query UI", () => {
  it.each(["do", "done", "skip"] as const)("filters by query expression is:%s", async (status) => {
    await repo.insert(taskFixture({ id: "do-1", status: "do" }));
    await repo.insert(taskFixture({ id: "done-1", status: "done" }));
    await repo.insert(taskFixture({ id: "skip-1", status: "skip" }));

    const body = await (await request(`/tasks?q=is:${status}`)).text();

    expect(body).toContain(`${status}-1`);
    expect(body).toContain(`value="is:${status}"`);
    for (const other of ["do", "done", "skip"] as const) {
      if (other !== status) expect(body).not.toContain(`${other}-1`);
    }
  });

});

describe("Task list working and free text query", () => {
  it("combines a status query with the working filter", async () => {
    await repo.insert(taskFixture({ id: "working", status: "do", working: true }));
    await repo.insert(taskFixture({ id: "idle", status: "do", working: false }));

    const body = await (await request("/tasks?q=is:do%20working:on")).text();

    expect(body).toContain('data-task-id="working"');
    expect(body).not.toContain('data-task-id="idle"');
    expect(body).toContain(
      `href="/tasks?status=do&amp;working=on&amp;q=${encodeURIComponent("is:do working:on")}"`,
    );
  });

});

describe("Task list status tabs", () => {
  it("keeps the other filters when switching status tabs", async () => {
    const query = "is:do project:Yoriwake working:on 見積もり";
    const body = await (await request(`/tasks?q=${encodeURIComponent(query)}`)).text();

    expect(body).toContain(
      `href="/tasks?status=done&amp;working=on&amp;q=${encodeURIComponent("is:done project:Yoriwake working:on 見積もり")}"`,
    );
    expect(body).toContain(
      `href="/tasks?status=skip&amp;working=on&amp;q=${encodeURIComponent("is:skip project:Yoriwake working:on 見積もり")}"`,
    );
  });

  it("filters by working:off and by free text", async () => {
    await repo.insert(taskFixture({ id: "busy", title: "見積もりを送る", status: "do", working: true }));
    await repo.insert(taskFixture({ id: "idle", title: "別の作業", status: "do", working: false }));

    const offBody = await (await request("/tasks?q=is:do%20working:off")).text();
    expect(offBody).toContain('data-task-id="idle"');
    expect(offBody).not.toContain('data-task-id="busy"');

    const textBody = await (await request(`/tasks?q=${encodeURIComponent("is:do 見積もり")}`)).text();
    expect(textBody).toContain('data-task-id="busy"');
    expect(textBody).not.toContain('data-task-id="idle"');

    const workingOffBody = await (await request("/tasks?working=off")).text();
    expect(workingOffBody).toContain('data-task-id="idle"');
    expect(workingOffBody).not.toContain('data-task-id="busy"');
  });

  it("filters by project id and by unassigned", async () => {
    await repo.insert(taskFixture({ id: "yoriwake", title: "yoriwake task", status: "do", project: "Yoriwake" }));
    await repo.insert(taskFixture({ id: "dsh", title: "dsh task", status: "do", project: "dsh" }));
    await repo.insert(taskFixture({ id: "none", title: "none task", status: "do", project: null }));

    const projectBody = await (await request("/tasks?q=is:do%20project:Yoriwake")).text();
    expect(projectBody).toContain("yoriwake task");
    expect(projectBody).not.toContain("dsh task");
    expect(projectBody).not.toContain("none task");

    const noneBody = await (await request("/tasks?q=is:do%20project:none")).text();
    expect(noneBody).toContain("none task");
    expect(noneBody).not.toContain("yoriwake task");
    expect(noneBody).not.toContain("dsh task");
  });

  it("keeps a valid query when navigating labels", async () => {
    const body = await (await request("/tasks?q=is:do%20working:on")).text();

    expect(body).toContain('href="/tasks?status=do&amp;q=is%3Ado"');
    expect(body).toContain('href="/tasks?status=do&amp;working=on&amp;q=is%3Ado%20working%3Aon"');
  });

  it("offers project choices in the labels menu", async () => {
    const body = await (await request("/tasks?q=is:do")).text();

    expect(body).toContain("Projects");
    expect(body).toContain('href="/tasks?status=do&amp;q=is%3Ado%20project%3AYoriwake"');
    expect(body).toContain('href="/tasks?status=do&amp;q=is%3Ado%20project%3Anone"');
  });

  it("keeps a valid query in pagination links", async () => {
    await seedDoTasks(26);

    const body = await (await request("/tasks?q=is:do&page=1")).text();

    expect(body).toContain('href="/tasks?status=do&amp;q=is%3Ado&amp;page=2"');
  });
});

describe("Task list working filter", () => {
  it("filters the list to working tasks only when requested", async () => {
    await repo.insert(
      taskFixture({ id: "working-1", status: "do", working: true, title: "working task" }),
    );
    await repo.insert(taskFixture({ id: "idle-1", status: "do", working: false, title: "idle task" }));
    await repo.insert(
      taskFixture({
        id: "working-done-1",
        status: "done",
        working: true,
        title: "done working task",
      }),
    );

    const body = await (await request("/tasks?status=do&working=only")).text();

    expect(body).toContain("working task");
    expect(body).not.toContain("idle task");
    expect(body).not.toContain("done working task");
    expect(body).toContain("working:on");
  });

  it("keeps the status filter when toggling the working filter", async () => {
    const body = await (await request("/tasks?status=done")).text();

    expect(body).toContain('href="/tasks?status=done&amp;working=on&amp;q=is%3Adone%20working%3Aon"');
  });

  it("preserves the status filter on working filter links", async () => {
    const body = await (await request("/tasks?status=skip")).text();

    expect(body).toContain('href="/tasks?status=skip&amp;working=on&amp;q=is%3Askip%20working%3Aon"');
  });
});

describe("Task list pagination", () => {
  it("hides the page nav for 25 or fewer tasks", async () => {
    await seedDoTasks(25);

    const body = await (await request("/tasks?status=do")).text();

    expect(countTaskRows(body)).toBe(25);
    expect(body).not.toContain('aria-label="Task list pages"');
  });

  it("shows the first 25 tasks on page 1", async () => {
    await seedDoTasks(26);

    const firstBody = await (await request("/tasks?status=do")).text();
    expect(countTaskRows(firstBody)).toBe(25);
    expect(firstBody).toContain("seed-001");
    expect(firstBody).toContain("seed-025");
    expect(firstBody).not.toContain("seed-026");
    expect(firstBody).toContain('href="/tasks?status=do&amp;page=2"');
    expect(firstBody).toContain('aria-current="page"');
    expect(firstBody).toContain('aria-disabled="true"');
    expect(firstBody).toContain("前へ");
    expect(firstBody).toContain("次へ");
  });

  it("shows the remaining tasks on page 2", async () => {
    await seedDoTasks(26);

    const secondBody = await (await request("/tasks?status=do&page=2")).text();
    expect(countTaskRows(secondBody)).toBe(1);
    expect(secondBody).toContain("seed-026");
    expect(secondBody).not.toContain("seed-001");
    expect(secondBody).toContain('href="/tasks?status=do&amp;page=1"');
  });

  it("keeps status filter links on page 1", async () => {
    await seedDoTasks(26);

    const body = await (await request("/tasks?status=do&page=2")).text();

    expect(body).toContain('href="/tasks?status=done"');
    expect(body).not.toContain("status=done&amp;page");
  });

  it("falls back to page 1 for a non-numeric page and clamps overflow to the last page", async () => {
    await seedDoTasks(26);

    const invalidBody = await (await request("/tasks?status=do&page=abc")).text();
    expect(countTaskRows(invalidBody)).toBe(25);
    expect(invalidBody).toContain("seed-001");

    const overflowBody = await (await request("/tasks?status=do&page=999")).text();
    expect(countTaskRows(overflowBody)).toBe(1);
    expect(overflowBody).toContain("seed-026");
  });

  it("collapses the gap between the ends and the middle pages", async () => {
    await seedDoTasks(250);

    const body = await (await request("/tasks?status=do&page=5")).text();

    expect(body.split("pagination-ellipsis").length - 1).toBe(2);
    expect(body).toContain('href="/tasks?status=do&amp;page=1"');
    expect(body).toContain('href="/tasks?status=do&amp;page=10"');
    expect(body).toContain('aria-current="page"');
  });

  it("hides the page nav for an empty filtered list", async () => {
    const body = await (await request("/tasks?status=skip")).text();

    expect(body).toContain("該当するtaskはありません。");
    expect(body).not.toContain('aria-label="Task list pages"');
  });
});

describe("Task list working and pagination interaction", () => {
  it("keeps the working filter in pagination links", async () => {
    await repo.insert(
      taskFixture({ id: "working-1", status: "do", working: true, title: "working task" }),
    );

    const body = await (await request("/tasks?status=do&working=only")).text();

    expect(body).toContain("working task");
  });

  it("resets to page 1 when switching status from a working-filtered page", async () => {
    const body = await (await request("/tasks?status=do&working=on&page=2")).text();

    expect(body).toContain('href="/tasks?status=done&amp;working=on"');
    expect(body).not.toContain("status=done&amp;working=on&amp;page");
  });
});

describe("Task creation", () => {
  it("redirects to the task list after creating a task", async () => {
    const response = await request("/tasks", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ title: "Buy milk", description: "low-fat" }).toString(),
    });
    expect(response.status).toBe(201);
    expect(response.headers.get("hx-redirect")).toBe("/tasks");
    expect(await response.text()).toBe("");

    const listed = await repo.list();
    if (!listed.ok) throw new Error("expected task list");
    expect(listed.value).toEqual(
      expect.arrayContaining([expect.objectContaining({ title: "Buy milk", project: null })]),
    );
  });

  it("creates a task with the selected status and project", async () => {
    const response = await request("/tasks", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        title: "Plan",
        description: "",
        status: "done",
        project: "dsh",
      }).toString(),
    });
    expect(response.status).toBe(201);

    const listed = await repo.list();
    if (!listed.ok) throw new Error("expected task list");
    expect(listed.value).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Plan", status: "done", project: "dsh" }),
      ]),
    );
  });

  it("rejects an unknown project on create", async () => {
    const response = await request("/tasks", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ title: "Plan", description: "", project: "missing" }).toString(),
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Unknown project.");
    const listed = await repo.list();
    if (!listed.ok) throw new Error("expected task list");
    expect(listed.value).toEqual([]);
  });

});

describe("New task page", () => {
  it("renders the new task page with cancel and a project select", async () => {
    const body = await (await request("/tasks/new?project=dsh&status=done")).text();

    expect(body).toContain("New task");
    expect(body).toContain("Cancel");
    expect(body).toContain("Create");
    expect(body).toContain('data-task-form="new"');
    expect(body).toContain("status status--done");
    expect(body).toContain('name="project"');
    expect(body).toContain('<option value="dsh" selected');
    expect(body).toContain("未分類");
    expect(body).not.toContain('name="area"');
  });

  it("defaults the project to 未分類 when the query omits it", async () => {
    const body = await (await request("/tasks/new?status=do")).text();

    expect(body).toContain('<option value="" selected');
  });

  it("ignores an unknown project query on the new task page", async () => {
    const body = await (await request("/tasks/new?project=missing")).text();

    expect(body).toContain('<option value="" selected');
  });
});

describe("Task creation origin tracking", () => {
  it("renders cancel returning to the task list", async () => {
    const body = await (await request("/tasks/new?status=done")).text();

    expect(body).toContain('href="/tasks"');
    expect(body).toContain("New task");
    expect(body).toContain("Cancel");
  });

  it("renders the task list New task link", async () => {
    const body = await (await request("/tasks")).text();

    expect(body).toContain('href="/tasks/new"');
  });

  it("carries the searched project into the New task link", async () => {
    const body = await (await request("/tasks?q=is:do%20project:Yoriwake")).text();

    expect(body).toContain('href="/tasks/new?project=Yoriwake"');
  });
});

describe("Task detail Save form", () => {
  it("renders a Save form when opened from the task list", async () => {
    await repo.insert(taskFixture({ id: "task-1", version: 3 }));

    const response = await request("/tasks/task-1?from=tasks");
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('method="post"');
    expect(body).toContain('action="/tasks/task-1"');
    expect(body).toContain('hx-post="/tasks/task-1"');
    expect(body).toContain('id="task-version" type="hidden" name="version" value="3"');
    expect(body).toContain('data-task-form="edit"');
    expect(body).toContain('<button class="button primary" type="submit">Save</button>');
    expect(body).toContain('class="button" href="/tasks?status=do"');
  });

  it("saves edits and redirects to the task list", async () => {
    await repo.insert(taskFixture({ id: "task-1", version: 3 }));

    const response = await request("/tasks/task-1?from=tasks", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        title: "updated task",
        description: "updated description",
        version: "3",
      }).toString(),
    });
    const saved = await repo.find("task-1", "local");

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/tasks");
    expect(saved).toEqual(
      expect.objectContaining({
        ok: true,
        value: expect.objectContaining({
          title: "updated task",
          description: "updated description",
          version: 4,
        }),
      }),
    );
  });
});

describe("Task detail Cancel destination (issue 546)", () => {
  it.each([
    ["do", "/tasks?status=do"],
    ["done", "/tasks?status=done"],
    ["skip", "/tasks?status=skip"],
  ] as const)("returns to the %s list when Cancel is pressed", async (status, expected) => {
    await repo.insert(taskFixture({ id: "task-1", status }));

    const listBody = await (await request(`/tasks?status=${status}`)).text();
    expect(listBody).toContain(`href="/tasks/task-1?from=tasks&amp;status=${status}"`);

    const detailBody = await (await request(`/tasks/task-1?from=tasks&status=${status}`)).text();
    expect(detailBody).toContain(`class="button" href="${expected}"`);
  });
});

describe("Task detail and metadata menus", () => {
  it("renders detail and status menu fragments", async () => {
    await repo.insert(taskFixture({ id: "task-1", project: "Yoriwake", status: "do" }));

    const detail = await request("/tasks/task-1");
    expect(detail.status).toBe(200);
    expect(await detail.text()).toContain("seed task");

    const statusMenu = await request("/tasks/task-1/status/menu");
    const statusBody = await statusMenu.text();
    expect(statusMenu.status).toBe(200);
    expect(statusBody).toContain("do");
    expect(statusBody).toContain("done");
    expect(statusBody).toContain("skip");

    const areaMenu = await request("/tasks/task-1/area/menu");
    expect(areaMenu.status).toBe(404);
  });

  it("renders popovers with selected and suggestion groups", async () => {
    await repo.insert(taskFixture({ id: "task-1", project: "Yoriwake", status: "do" }));

    const statusBody = await (await request("/tasks/task-1/status/menu")).text();
    expect(statusBody).toContain("Apply status to this task");
    expect(statusBody).toContain("Selected status");
    expect(statusBody).toContain("Suggestions");
    expect(statusBody).toContain('hx-target="#task-meta"');
    expect(statusBody).toContain('aria-label="Project"');
  });

  it.each([
    ["status", "done", "/tasks/task-1/status"],
    ["project", "dsh", "/tasks/task-1/project"],
  ])("refreshes the form version after changing %s", async (_kind, value, path) => {
    await repo.insert(taskFixture({ id: "task-1", version: 3 }));

    const response = await request(path, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ [_kind]: value, version: "3" }).toString(),
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('id="task-version" type="hidden" name="version" value="4" hx-swap-oob="true"');
  });

  it("rejects an unknown project from the detail metadata", async () => {
    await repo.insert(taskFixture({ id: "task-1", version: 3 }));

    const response = await request("/tasks/task-1/project", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ project: "missing", version: "3" }).toString(),
    });

    expect(response.status).toBe(400);
  });
});

describe("BDD-TM-006: DS project groups", () => {
  it("groups the status-filtered tasks by project with 未分類 last", async () => {
    await repo.insert(taskFixture({ id: "yoriwake-1", title: "yoriwake task", status: "do", project: "Yoriwake" }));
    await repo.insert(taskFixture({ id: "dsh-1", title: "dsh task", status: "do", project: "dsh" }));
    await repo.insert(taskFixture({ id: "none-1", title: "none task", status: "do", project: null }));
    await repo.insert(taskFixture({ id: "done-1", title: "done task", status: "done", project: "dsh" }));

    const response = await request("/ds");
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('data-ds-group-id="Yoriwake"');
    expect(body).toContain('data-ds-group-id="dsh"');
    expect(body).toContain('data-ds-group-id=""');
    expect(body).toContain("未分類");
    expect(body).toContain("yoriwake task");
    expect(body).not.toContain("done task");
    const yoriwakeGroup = body.indexOf('data-ds-group-id="Yoriwake"');
    const noneGroup = body.indexOf('data-ds-group-id=""');
    expect(noneGroup).toBeGreaterThan(yoriwakeGroup);
  });
});

describe("Description edit followed by Status operation (issue 477)", () => {
  it("applies Status with the fresh version after saving a description edit", async () => {
    await repo.insert(taskFixture({ id: "task-1", version: 3, status: "do" }));

    const save = await request("/tasks/task-1?from=tasks", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        title: "seed task",
        description: "updated description",
        version: "3",
      }).toString(),
    });
    expect(save.status).toBe(302);

    const status = await request("/tasks/task-1/status", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ status: "done", version: "4" }).toString(),
    });
    const statusBody = await status.text();

    expect(status.status).toBe(200);
    expect(statusBody).toContain(
      'id="task-version" type="hidden" name="version" value="5" hx-swap-oob="true"',
    );

    const saved = await repo.find("task-1", "local");
    expect(saved).toEqual(
      expect.objectContaining({
        ok: true,
        value: expect.objectContaining({
          description: "updated description",
          status: "done",
          version: 5,
        }),
      }),
    );
  });

  it("returns a recoverable conflict instead of hanging on a stale Status version", async () => {
    await repo.insert(taskFixture({ id: "task-1", version: 3, status: "do" }));

    await request("/tasks/task-1?from=tasks", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        title: "seed task",
        description: "updated description",
        version: "3",
      }).toString(),
    });

    const stale = await request("/tasks/task-1/status", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ status: "done", version: "3" }).toString(),
    });

    expect(stale.status).toBe(409);
    expect(await stale.text()).toContain("Load latest");
  });
});

describe("Task detail working toggle", () => {
  it("toggles working from the detail metadata and refreshes the version", async () => {
    await repo.insert(taskFixture({ id: "task-1", version: 3, working: false }));

    const response = await request("/tasks/task-1/working", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ working: "true", version: "3" }).toString(),
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain(
      'id="task-version" type="hidden" name="version" value="4" hx-swap-oob="true"',
    );
    expect(body).toContain(">working</button>");

    const saved = await repo.find("task-1", "local");
    expect(saved).toEqual(expect.objectContaining({ ok: true }));
    if (saved.ok && saved.value) expect(saved.value.working).toBe(true);
  });

  it("rejects an invalid working value from the detail metadata", async () => {
    await repo.insert(taskFixture({ id: "task-1", version: 3 }));

    const response = await request("/tasks/task-1/working", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ working: "yes", version: "3" }).toString(),
    });

    expect(response.status).toBe(400);
  });
});
