import { beforeEach, describe, expect, it } from "vite-plus/test";
import type { Task } from "../../src/task";
import { authenticatedRequest } from "../helpers/authenticated-request";
import { taskFixture } from "../helpers/task-fixture";
import { createMemoryTaskRepository } from "../helpers/memory-task-repository";
import type { TaskRepository } from "../../src/repository/task-repository";

let repo: TaskRepository;

beforeEach(() => {
  repo = createMemoryTaskRepository();
});

function request(method: string, path: string, body?: unknown) {
  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json" },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  return authenticatedRequest(path, repo, init);
}

describe("BDD-TM-001: task creation", () => {
  it("returns 201 and the created task attributes", async () => {
    const response = await request("POST", "/api/tasks", {
      title: "Buy milk",
      description: "low-fat",
    });

    expect(response.status).toBe(201);
    expect(response.headers.get("location")).toMatch(/^\/api\/tasks\//);

    const task: Task = await response.json();
    expect(task.title).toBe("Buy milk");
    expect(task.description).toBe("low-fat");
    expect(task.status).toBe("do");
    expect(task.project).toBeNull();
    expect(task.order).toBe(1);
    expect(task.version).toBe(1);
    expect(task.id).toEqual(expect.any(String));
  });

  it("maps a domain validation failure to an HTTP status and error code", async () => {
    const response = await request("POST", "/api/tasks", {
      title: "",
      description: "invalid",
    });
    const body: { code?: string } = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_TITLE");
  });

  it("INV-TM-004: appends the new task after the current order", async () => {
    await repo.insert(taskFixture({ id: "task-1", order: 5 }));

    const response = await request("POST", "/api/tasks", { title: "Buy milk", description: "" });
    const task: Task = await response.json();

    expect(response.status).toBe(201);
    expect(task.order).toBe(6);
  });
});

describe("BDD-TM-002: project assignment", () => {
  it("creates a task with a known project", async () => {
    const response = await request("POST", "/api/tasks", {
      title: "Buy milk",
      description: "",
      project: "Yoriwake",
    });
    const task: Task = await response.json();

    expect(response.status).toBe(201);
    expect(task.project).toBe("Yoriwake");
  });

  it("rejects an unknown project id", async () => {
    const response = await request("POST", "/api/tasks", {
      title: "Buy milk",
      description: "",
      project: "missing",
    });
    const body: { code?: string } = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_PROJECT");
  });

  it("rejects a malformed project id", async () => {
    await repo.insert(taskFixture({ id: "task-1" }));

    const response = await request("PATCH", "/api/tasks/task-1", {
      project: "Bad Id",
      version: 1,
    });
    const body: { code?: string } = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_PROJECT");
  });

  it("clears the project with an explicit null", async () => {
    await repo.insert(taskFixture({ id: "task-1", project: "dsh" }));

    const response = await request("PATCH", "/api/tasks/task-1", {
      project: null,
      version: 1,
    });
    const task: Task = await response.json();

    expect(response.status).toBe(200);
    expect(task.project).toBeNull();
  });

  it("lists the selectable projects", async () => {
    const response = await request("GET", "/api/projects");
    const projects: { id: string; sort_order: number }[] = await response.json();

    expect(response.status).toBe(200);
    expect(projects.map((project) => project.id)).toContain("Yoriwake");
    expect(projects.map((project) => project.id)).toEqual([
      "Yoriwake",
      "dsh",
      "customer_portal",
      "affiliate",
      "kits",
      "scripts",
    ]);
  });
});

describe("BDD-TM-003: task list", () => {
  it("returns active tasks in the list", async () => {
    await repo.insert(taskFixture({ id: "task-1", status: "do" }));

    const response = await request("GET", "/api/tasks");
    const tasks: Task[] = await response.json();

    expect(response.status).toBe(200);
    expect(tasks.map((task) => task.id)).toContain("task-1");
  });

  it("keeps done and skip tasks in the list", async () => {
    await repo.insert(taskFixture({ id: "done-1", status: "done" }));
    await repo.insert(taskFixture({ id: "skip-1", status: "skip" }));

    const response = await request("GET", "/api/tasks");
    const tasks: Task[] = await response.json();

    expect(response.status).toBe(200);
    expect(tasks.map((task) => task.id)).toEqual(expect.arrayContaining(["done-1", "skip-1"]));
  });
});

describe("BDD-TM-005 / BDD-TM-007: task update", () => {
  it("updates title and description", async () => {
    await repo.insert(taskFixture({ id: "task-1" }));

    const response = await request("PATCH", "/api/tasks/task-1", {
      title: "new title",
      description: "new description",
      version: 1,
    });
    const task: Task = await response.json();

    expect(response.status).toBe(200);
    expect(task.title).toBe("new title");
    expect(task.description).toBe("new description");
  });

  it("updates status and project", async () => {
    await repo.insert(taskFixture({ id: "task-1" }));

    const response = await request("PATCH", "/api/tasks/task-1", {
      status: "done",
      project: "dsh",
      version: 1,
    });
    const task: Task = await response.json();

    expect(response.status).toBe(200);
    expect(task.status).toBe("done");
    expect(task.project).toBe("dsh");
  });

  it("keeps the project when only the status changes", async () => {
    await repo.insert(taskFixture({ id: "task-1", project: "Yoriwake" }));

    const response = await request("PATCH", "/api/tasks/task-1", {
      status: "done",
      version: 1,
    });
    const task: Task = await response.json();

    expect(response.status).toBe(200);
    expect(task.status).toBe("done");
    expect(task.project).toBe("Yoriwake");
  });
});

describe("task update conflict and working", () => {
  it("returns a conflict for a stale status change", async () => {
    await repo.insert(taskFixture({ id: "task-1", version: 2 }));

    const response = await request("PATCH", "/api/tasks/task-1", {
      status: "done",
      version: 1,
    });
    const body: { code?: string } = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("CONFLICT");
  });

  it("toggles working without changing status", async () => {
    await repo.insert(taskFixture({ id: "task-1", status: "do", working: false }));

    const response = await request("PATCH", "/api/tasks/task-1", {
      working: true,
      version: 1,
    });
    const task: Task = await response.json();

    expect(response.status).toBe(200);
    expect(task.working).toBe(true);
    expect(task.status).toBe("do");
  });

  it("rejects a non-boolean working value", async () => {
    await repo.insert(taskFixture({ id: "task-1" }));

    const response = await request("PATCH", "/api/tasks/task-1", {
      working: "yes",
      version: 1,
    });
    const body: { code?: string } = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_WORKING");
  });
});

describe("INV-TM-006: API description validation", () => {
  it("rejects an oversized description", async () => {
    await repo.insert(taskFixture({ id: "task-1" }));

    const response = await request("PATCH", "/api/tasks/task-1", {
      description: "😀".repeat(16_385),
      version: 1,
    });
    const body: { code?: string } = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_DESCRIPTION");
  });
});

describe("BDD-TM-004: bulk project update", () => {
  it("assigns a project to the selected tasks", async () => {
    await repo.insert(taskFixture({ id: "task-1", project: null, version: 1 }));
    await repo.insert(taskFixture({ id: "task-2", project: null, version: 1 }));

    const response = await request("PATCH", "/api/tasks/bulk/project", {
      project: "Yoriwake",
      tasks: [
        { id: "task-1", version: 1 },
        { id: "task-2", version: 1 },
      ],
    });
    const tasks: Task[] = await response.json();

    expect(response.status).toBe(200);
    expect(tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "task-1", project: "Yoriwake", version: 2 }),
        expect.objectContaining({ id: "task-2", project: "Yoriwake", version: 2 }),
      ]),
    );
  });

  it("clears the project when null is requested", async () => {
    await repo.insert(taskFixture({ id: "task-1", project: "dsh", version: 1 }));

    const response = await request("PATCH", "/api/tasks/bulk/project", {
      project: null,
      tasks: [{ id: "task-1", version: 1 }],
    });
    const tasks: Task[] = await response.json();

    expect(response.status).toBe(200);
    expect(tasks[0]?.project).toBeNull();
  });

  it("rejects an unknown project", async () => {
    await repo.insert(taskFixture({ id: "task-1", version: 1 }));

    const response = await request("PATCH", "/api/tasks/bulk/project", {
      project: "missing",
      tasks: [{ id: "task-1", version: 1 }],
    });
    const body: { code?: string } = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_PROJECT");
  });

  it("rejects invalid bulk inputs", async () => {
    const response = await request("PATCH", "/api/tasks/bulk/project", {
      project: "dsh",
      tasks: [],
    });
    const body: { code?: string } = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_BULK_INPUT");
  });
});

describe("bulk status update", () => {
  it("updates selected tasks in one request", async () => {
    await repo.insert(taskFixture({ id: "task-1", status: "do", version: 1 }));
    await repo.insert(taskFixture({ id: "task-2", status: "do", version: 1 }));

    const response = await request("PATCH", "/api/tasks/bulk/status", {
      status: "done",
      tasks: [
        { id: "task-1", version: 1 },
        { id: "task-2", version: 1 },
      ],
    });
    const tasks: Task[] = await response.json();

    expect(response.status).toBe(200);
    expect(tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "task-1", status: "done", version: 2 }),
        expect.objectContaining({ id: "task-2", status: "done", version: 2 }),
      ]),
    );
  });

  it("rejects a stale task without partially updating the selection", async () => {
    await repo.insert(taskFixture({ id: "task-1", status: "do", version: 1 }));
    await repo.insert(taskFixture({ id: "task-2", status: "do", version: 2 }));

    const response = await request("PATCH", "/api/tasks/bulk/status", {
      status: "done",
      tasks: [
        { id: "task-1", version: 1 },
        { id: "task-2", version: 1 },
      ],
    });
    const body: { code?: string } = await response.json();
    const listed = await repo.list();

    expect(response.status).toBe(409);
    expect(body.code).toBe("CONFLICT");
    expect(listed).toEqual({
      ok: true,
      value: expect.arrayContaining([
        expect.objectContaining({ id: "task-1", status: "do", version: 1 }),
        expect.objectContaining({ id: "task-2", status: "do", version: 2 }),
      ]),
    });
  });

  it("rejects invalid bulk inputs", async () => {
    const response = await request("PATCH", "/api/tasks/bulk/status", {
      status: "done",
      tasks: [],
    });
    const body: { code?: string } = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_BULK_INPUT");
  });

});

describe("bulk input parsing", () => {
  it.each([
    ["PATCH", "/api/tasks/bulk/status"],
    ["DELETE", "/api/tasks/bulk"],
  ])("rejects malformed JSON safely for %s %s", async (method, path) => {
    for (const body of ["null", "{"]) {
      const response = await authenticatedRequest(path, repo, {
        method,
        headers: { "content-type": "application/json" },
        body,
      });
      const result: { code?: string } = await response.json();

      expect(response.status).toBe(400);
      expect(result.code).toBe("INVALID_BULK_INPUT");
    }
  });
});

describe("bulk deletion", () => {
  it("deletes selected tasks", async () => {
    await repo.insert(taskFixture({ id: "task-1" }));
    await repo.insert(taskFixture({ id: "task-2" }));

    const response = await request("DELETE", "/api/tasks/bulk", {
      tasks: [
        { id: "task-1", version: 1 },
        { id: "task-2", version: 1 },
      ],
    });
    const listed = await repo.list();

    expect(response.status).toBe(204);
    expect(listed).toEqual({ ok: true, value: [] });
  });
});

describe("BDD-TM-015: task deletion", () => {
  it("deletes a task with the current version", async () => {
    await repo.insert(taskFixture({ id: "task-1", version: 1 }));

    const response = await request("DELETE", "/api/tasks/task-1", { version: 1 });

    expect(response.status).toBe(204);
    expect(await repo.find("task-1", "owner-1")).toEqual({ ok: true, value: undefined });
  });

  it("returns a conflict for a stale delete", async () => {
    await repo.insert(taskFixture({ id: "task-1", version: 2 }));

    const response = await request("DELETE", "/api/tasks/task-1", { version: 1 });
    const body: { code?: string } = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("CONFLICT");
  });
});
