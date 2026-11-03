import { describe, expect, it } from "vite-plus/test";
import app from "../src/index";
import { createSession, SESSION_COOKIE_NAME } from "../src/auth";
import { createMemoryIdeaRepository } from "../src/preview/MemoryIdeaRepository";
import { createMemoryTaskRepository } from "../src/preview/MemoryTaskRepository";
import type { Idea } from "../src/idea";
import type { IdeaRepository } from "../src/repository/idea-repository";
import type { TaskRepository } from "../src/repository/task-repository";
import { taskFixture } from "./helpers/task-fixture";

const SECRET = "move-api-test-secret";

type Repositories = {
  tasks: TaskRepository;
  ideas: IdeaRepository;
};

function ideaFixture(overrides: Partial<Idea> = {}): Idea {
  return {
    id: "idea-1",
    owner_id: "local",
    title: "idea",
    description: "",
    order: 1,
    pinned: false,
    ...overrides,
  };
}

async function request(path: string, init: RequestInit, repositories: Repositories) {
  const cookie = await createSession(SECRET, Date.now() + 60_000);
  const headers = new Headers(init.headers);
  headers.set("Cookie", `${SESSION_COOKIE_NAME}=${cookie}`);
  return app.request(path, { ...init, headers }, {
    SESSION_SECRET: SECRET,
    TASK_REPOSITORY: repositories.tasks,
    IDEA_REPOSITORY: repositories.ideas,
  });
}

function json(body: unknown): RequestInit {
  return { headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

describe("Idea to task move API", () => {
  it("creates a task at the end of area 1 and removes the idea", async () => {
    const repositories: Repositories = {
      tasks: createMemoryTaskRepository([taskFixture({ id: "existing", area: 1, order: 5 })]),
      ideas: createMemoryIdeaRepository([
        ideaFixture({ id: "idea-1", title: "Move me", description: "memo", order: 4 }),
      ]),
    };

    const response = await request("/api/ideas/idea-1/move-to-task", { method: "POST" }, repositories);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      title: "Move me",
      description: "memo",
      status: "do",
      area: 1,
      working: false,
      order: 6,
    });

    expect(await (await request("/api/ideas", {}, repositories)).json()).toEqual([]);
    expect(await (await request("/api/tasks", {}, repositories)).json()).toHaveLength(2);
  });

  it("rolls back the created task when the idea cannot be removed", async () => {
    const base = createMemoryIdeaRepository([ideaFixture({ id: "idea-1", title: "Keep me" })]);
    const repositories: Repositories = {
      tasks: createMemoryTaskRepository(),
      ideas: {
        ...base,
        remove: async () => ({ ok: false, error: { code: "CONFLICT" } }),
      },
    };

    const response = await request("/api/ideas/idea-1/move-to-task", { method: "POST" }, repositories);
    expect(response.status).toBe(409);
    expect(await (await request("/api/tasks", {}, repositories)).json()).toEqual([]);
    expect(await (await request("/api/ideas", {}, repositories)).json()).toHaveLength(1);
  });

  it("returns not found for an unknown idea", async () => {
    const repositories: Repositories = {
      tasks: createMemoryTaskRepository(),
      ideas: createMemoryIdeaRepository(),
    };

    const response = await request("/api/ideas/missing/move-to-task", { method: "POST" }, repositories);
    expect(response.status).toBe(404);
  });
});

describe("Task to idea move API", () => {
  it("creates an unpinned idea at the end and removes the task", async () => {
    const repositories: Repositories = {
      tasks: createMemoryTaskRepository([
        taskFixture({ id: "task-1", title: "Task title", description: "task memo" }),
      ]),
      ideas: createMemoryIdeaRepository([ideaFixture({ id: "idea-1", order: 7, pinned: false })]),
    };

    const response = await request(
      "/api/tasks/task-1/move-to-idea",
      { method: "POST", ...json({ version: 1 }) },
      repositories,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      title: "Task title",
      description: "task memo",
      pinned: false,
      order: 8,
    });

    expect(await (await request("/api/tasks", {}, repositories)).json()).toEqual([]);
    expect(await (await request("/api/ideas", {}, repositories)).json()).toHaveLength(2);
  });

  it("rolls back the created idea when the task cannot be removed", async () => {
    const base = createMemoryTaskRepository([taskFixture({ id: "task-1", title: "Keep me" })]);
    const repositories: Repositories = {
      tasks: {
        ...base,
        remove: async () => ({ ok: false, error: { code: "CONFLICT" } }),
      },
      ideas: createMemoryIdeaRepository(),
    };

    const response = await request(
      "/api/tasks/task-1/move-to-idea",
      { method: "POST", ...json({ version: 1 }) },
      repositories,
    );
    expect(response.status).toBe(409);
    expect(await (await request("/api/ideas", {}, repositories)).json()).toEqual([]);
    expect(await (await request("/api/tasks", {}, repositories)).json()).toHaveLength(1);
  });

});

describe("Task to idea move validation", () => {
  it("rejects a missing or invalid version", async () => {
    const repositories: Repositories = {
      tasks: createMemoryTaskRepository([taskFixture({ id: "task-1" })]),
      ideas: createMemoryIdeaRepository(),
    };

    const missing = await request("/api/tasks/task-1/move-to-idea", { method: "POST", ...json({}) }, repositories);
    expect(missing.status).toBe(400);

    const invalid = await request(
      "/api/tasks/task-1/move-to-idea",
      { method: "POST", ...json({ version: "1" }) },
      repositories,
    );
    expect(invalid.status).toBe(400);
    expect(await (await request("/api/ideas", {}, repositories)).json()).toEqual([]);
  });

  it("returns not found for an unknown task", async () => {
    const repositories: Repositories = {
      tasks: createMemoryTaskRepository(),
      ideas: createMemoryIdeaRepository(),
    };

    const response = await request(
      "/api/tasks/missing/move-to-idea",
      { method: "POST", ...json({ version: 1 }) },
      repositories,
    );
    expect(response.status).toBe(404);
  });
});
