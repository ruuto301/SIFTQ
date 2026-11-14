import { describe, expect, it } from "vite-plus/test";
import app from "../src/index";
import { SESSION_COOKIE_NAME, createSession } from "../src/auth";
import { createMemoryProjectRepository } from "../src/preview/MemoryProjectRepository";
import { createMemoryTaskRepository } from "../src/preview/MemoryTaskRepository";
import type { Project } from "../src/project";
import type { ProjectRepository } from "../src/repository/project-repository";
import type { TaskRepository } from "../src/repository/task-repository";
import { taskFixture } from "./helpers/task-fixture";

const SECRET = "project-api-test-secret";

const SEED: readonly Project[] = [
  { id: "alpha", name: "Alpha", sort_order: 1 },
  { id: "beta", name: "Beta", sort_order: 2 },
];

function seeded(): ProjectRepository {
  return createMemoryProjectRepository(SEED);
}

async function request(
  path: string,
  init: RequestInit,
  projects: ProjectRepository,
  tasks: TaskRepository = createMemoryTaskRepository(),
) {
  const cookie = await createSession(SECRET, Date.now() + 60_000);
  const headers = new Headers(init.headers);
  headers.set("Cookie", `${SESSION_COOKIE_NAME}=${cookie}`);
  return app.request(path, { ...init, headers }, {
    SESSION_SECRET: SECRET,
    PROJECT_REPOSITORY: projects,
    TASK_REPOSITORY: tasks,
  });
}

function json(method: string, body: unknown): RequestInit {
  return { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

async function listedIds(projects: ProjectRepository): Promise<string[]> {
  const listed: Project[] = await (await request("/api/projects", {}, projects)).json();
  return listed.map((project) => project.id);
}

describe("project create API", () => {
  it("creates a project with the next sort order and returns its location", async () => {
    const projects = seeded();

    const response = await request("/api/projects", json("POST", { id: "gamma", name: "Gamma" }), projects);

    expect(response.status).toBe(201);
    expect(response.headers.get("Location")).toBe("/api/projects/gamma");
    expect(await response.json()).toEqual({ id: "gamma", name: "Gamma", sort_order: 3 });
    expect(await listedIds(projects)).toEqual(["alpha", "beta", "gamma"]);
  });

  it("trims the name", async () => {
    const projects = seeded();

    const response = await request("/api/projects", json("POST", { id: "gamma", name: "  Gamma  " }), projects);

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: "gamma", name: "Gamma", sort_order: 3 });
  });

  it("rejects a duplicated id without changing the list", async () => {
    const projects = seeded();

    const response = await request("/api/projects", json("POST", { id: "alpha", name: "Alpha 2" }), projects);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ code: "CONFLICT" });
    expect(await listedIds(projects)).toEqual(["alpha", "beta"]);
  });
});

describe("project create API validation", () => {
  it("rejects an invalid id and name", async () => {
    const projects = seeded();
    const bodies: Record<string, unknown>[] = [
      { id: "Bad Id", name: "Gamma" },
      { name: "Gamma" },
      { id: "gamma", name: "   " },
      { id: "gamma", name: 3 },
      { id: "gamma", name: "a".repeat(33) },
    ];

    for (const body of bodies) {
      const response = await request("/api/projects", json("POST", body), projects);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ code: "INVALID_INPUT" });
    }
    expect(await listedIds(projects)).toEqual(["alpha", "beta"]);
  });

  it("rejects a request without a JSON object body", async () => {
    const projects = seeded();

    const response = await request("/api/projects", { method: "POST", body: "not json" }, projects);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ code: "INVALID_INPUT" });
  });
});

describe("project update API", () => {
  it("renames the project and keeps the id and order", async () => {
    const projects = seeded();

    const response = await request("/api/projects/alpha", json("PATCH", { name: "  Alpha 2  " }), projects);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "alpha", name: "Alpha 2", sort_order: 1 });
    expect(await listedIds(projects)).toEqual(["alpha", "beta"]);
  });

  it("returns not found for an unknown project", async () => {
    const projects = seeded();

    const response = await request("/api/projects/missing", json("PATCH", { name: "Missing" }), projects);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ code: "NOT_FOUND" });
  });

  it("rejects an invalid name", async () => {
    const projects = seeded();
    const bodies: Record<string, unknown>[] = [{ name: "" }, { name: 3 }, { name: "a".repeat(33) }];

    for (const body of bodies) {
      const response = await request("/api/projects/alpha", json("PATCH", body), projects);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ code: "INVALID_INPUT" });
    }
    const found = await projects.find("alpha");
    expect(found).toEqual({ ok: true, value: SEED[0] });
  });

  it("rejects a request without a JSON object body", async () => {
    const projects = seeded();

    const response = await request("/api/projects/alpha", { method: "PATCH", body: "not json" }, projects);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ code: "INVALID_INPUT" });
  });
});

describe("project delete API", () => {
  it("moves the project tasks to 未分類 and then deletes the project", async () => {
    const projects = seeded();
    const tasks = createMemoryTaskRepository([
      taskFixture({ id: "task-1", project: "alpha" }),
      taskFixture({ id: "task-2", project: "alpha" }),
      taskFixture({ id: "task-3", project: "beta" }),
    ]);

    const response = await request("/api/projects/alpha", { method: "DELETE" }, projects, tasks);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "alpha", moved: 2 });
    expect(await listedIds(projects)).toEqual(["beta"]);
    const listed = await tasks.list();
    if (!listed.ok) throw new Error("expected task list");
    expect(listed.value.map((task) => [task.id, task.project])).toEqual([
      ["task-1", null],
      ["task-2", null],
      ["task-3", "beta"],
    ]);
  });

  it("deletes a project without tasks and reports zero moved", async () => {
    const projects = seeded();

    const response = await request("/api/projects/beta", { method: "DELETE" }, projects);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "beta", moved: 0 });
    expect(await listedIds(projects)).toEqual(["alpha"]);
  });

  it("returns not found for an unknown project", async () => {
    const projects = seeded();

    const response = await request("/api/projects/missing", { method: "DELETE" }, projects);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ code: "NOT_FOUND" });
  });
});
