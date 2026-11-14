import { describe, expect, it } from "vite-plus/test";
import app from "../src/index";
import { createSession, SESSION_COOKIE_NAME } from "../src/auth";
import { createMemoryTaskRepository } from "../src/preview/MemoryTaskRepository";
import type { TaskRepository } from "../src/repository/task-repository";
import type { Task } from "../src/task";
import { taskFixture } from "./helpers/task-fixture";

const SECRET = "task-create-api-test-secret";

async function request(path: string, init: RequestInit, tasks: TaskRepository) {
  const cookie = await createSession(SECRET, Date.now() + 60_000);
  const headers = new Headers(init.headers);
  headers.set("Cookie", `${SESSION_COOKIE_NAME}=${cookie}`);
  return app.request(path, { ...init, headers }, { SESSION_SECRET: SECRET, TASK_REPOSITORY: tasks });
}

function createBody(body: Record<string, unknown>): RequestInit {
  return { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

async function orders(tasks: TaskRepository): Promise<Record<string, number>> {
  const listed: Task[] = await (await request("/api/tasks", {}, tasks)).json();
  return Object.fromEntries(listed.map((task) => [task.id, task.order]));
}

function seeded(): TaskRepository {
  return createMemoryTaskRepository([
    taskFixture({ id: "a", title: "a", order: 1 }),
    taskFixture({ id: "b", title: "b", order: 2 }),
  ]);
}

describe("task create API", () => {
  it("appends a task at the end by default", async () => {
    const tasks = seeded();
    const response = await request("/api/tasks", createBody({ title: "last", description: "" }), tasks);

    expect(response.status).toBe(201);
    const created: Task = await response.json();
    expect(created.order).toBe(3);
    expect(await orders(tasks)).toEqual({ a: 1, b: 2, [created.id]: 3 });
  });

  it("puts a task first and shifts the existing tasks when position is first (BDD-TM-031)", async () => {
    const tasks = seeded();
    const response = await request(
      "/api/tasks",
      createBody({ title: "first", description: "", position: "first" }),
      tasks,
    );

    expect(response.status).toBe(201);
    const created: Task = await response.json();
    expect(created.order).toBe(1);
    expect(await orders(tasks)).toEqual({ a: 2, b: 3, [created.id]: 1 });
  });

  it("rejects an unknown position", async () => {
    const tasks = seeded();
    const response = await request(
      "/api/tasks",
      createBody({ title: "middle", description: "", position: "middle" }),
      tasks,
    );

    expect(response.status).toBe(400);
    expect(await orders(tasks)).toEqual({ a: 1, b: 2 });
  });
});
