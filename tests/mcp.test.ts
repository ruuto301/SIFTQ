import { describe, expect, it } from "vite-plus/test";
import app from "../src/index";
import { MCP_TOOLS, findTool } from "../src/mcp";
import type { ToolContext, ToolResult } from "../src/mcp/types";
import { createMemoryTaskRepository } from "../src/preview/MemoryTaskRepository";
import { createMemoryProjectRepository } from "../src/preview/MemoryProjectRepository";
import { createMemoryIdeaRepository } from "../src/preview/MemoryIdeaRepository";
import { PREVIEW_PROJECTS } from "../src/preview/projects";
import { createMemoryOAuthRepository } from "../src/preview/MemoryOAuthRepository";
import { taskFixture } from "./helpers/task-fixture";
import type { Env } from "../src/app-env";

function context(): ToolContext {
  return {
    env: {},
    tasks: createMemoryTaskRepository([
      taskFixture({ id: "a", title: "alpha", order: 1 }),
      taskFixture({ id: "b", title: "beta", order: 2, status: "done" }),
    ]),
    projects: createMemoryProjectRepository(PREVIEW_PROJECTS),
    ideas: createMemoryIdeaRepository(),
  };
}

async function call(ctx: ToolContext, name: string, args: Record<string, unknown> = {}): Promise<ToolResult> {
  const tool = findTool(name);
  if (tool === undefined) throw new Error(`unknown tool: ${name}`);
  return tool.handler(ctx, args);
}

function recordOf(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? { ...value } : {};
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function payload(result: ToolResult): unknown {
  const first = result.content[0];
  return JSON.parse(first === undefined ? "null" : first.text);
}

function code(result: ToolResult): string {
  const value = payload(result);
  return typeof value === "object" && value !== null && "code" in value ? String(value["code"]) : "";
}

describe("MCP tool registry", () => {
  it("exposes every operation for tasks, projects and ideas", () => {
    const names = MCP_TOOLS.map((tool) => tool.name);
    for (const name of [
      "list_tasks",
      "get_task",
      "task_summary",
      "create_task",
      "update_task",
      "delete_task",
      "reorder_tasks",
      "bulk_update_task_status",
      "bulk_update_task_project",
      "bulk_delete_tasks",
      "move_task_to_idea",
      "list_projects",
      "create_project",
      "update_project",
      "reorder_projects",
      "list_ideas",
      "create_idea",
      "update_idea",
      "delete_idea",
      "reorder_ideas",
      "move_idea_to_task",
    ]) {
      expect(names, name).toContain(name);
    }
  });

  it("marks read tools as read and everything else as write", () => {
    const scopeOf = (name: string) => MCP_TOOLS.find((tool) => tool.name === name)?.scope;
    expect(scopeOf("list_tasks")).toBe("read");
    expect(scopeOf("task_summary")).toBe("read");
    expect(scopeOf("list_projects")).toBe("read");
    expect(scopeOf("list_ideas")).toBe("read");
    expect(scopeOf("create_task")).toBe("write");
    expect(scopeOf("delete_task")).toBe("write");
    expect(scopeOf("move_idea_to_task")).toBe("write");
  });

  it("gives every tool a JSON Schema input", () => {
    for (const tool of MCP_TOOLS) {
      expect(tool.description.length, tool.name).toBeGreaterThan(0);
      expect(tool.inputSchema["type"], tool.name).toBe("object");
    }
  });
});

describe("MCP task tools (BDD-TM-032)", () => {
  it("lists and filters tasks, and reports a summary", async () => {
    const ctx = context();
    expect(await payload(await call(ctx, "list_tasks"))).toHaveLength(2);
    expect(await payload(await call(ctx, "list_tasks", { status: "done" }))).toHaveLength(1);
    expect(await payload(await call(ctx, "list_tasks", { query: "alpha" }))).toHaveLength(1);
    expect(await payload(await call(ctx, "list_tasks", { status: "skip" }))).toHaveLength(0);
    const summary = await payload(await call(ctx, "task_summary"));
    expect(summary).toMatchObject({ total: 2, by_status: { do: 1, done: 1, skip: 0 } });
  });

  it("returns an error result for an unknown task", async () => {
    const result = await call(context(), "get_task", { id: "missing" });
    expect(result.isError).toBe(true);
    expect(code(result)).toBe("NOT_FOUND");
  });

  it("creates a task at the top when position is first", async () => {
    const ctx = context();
    const created = await payload(await call(ctx, "create_task", { title: "first", position: "first" }));
    expect(created).toMatchObject({ title: "first", order: 1 });
    const listed = await payload(await call(ctx, "list_tasks"));
    expect(Array.isArray(listed)).toBe(true);
    const orders = Array.isArray(listed)
      ? listed.map((task) => [textOf(recordOf(task)["title"]), recordOf(task)["order"]])
      : [];
    expect(orders).toEqual([
      ["first", 1],
      ["alpha", 2],
      ["beta", 3],
    ]);
  });

  it("rejects an invalid task title and unknown status", async () => {
    const ctx = context();
    expect(code(await call(ctx, "create_task", { title: "   " }))).toBe("INVALID_TITLE");
    expect(code(await call(ctx, "create_task", { title: "ok", status: "later" }))).toBe("INVALID_STATUS");
  });
});

describe("MCP task mutation tools", () => {
  it("updates a task and rejects a stale version", async () => {
    const ctx = context();
    const updated = await payload(await call(ctx, "update_task", { id: "a", version: 1, status: "done" }));
    expect(updated).toMatchObject({ id: "a", status: "done", version: 2 });
    const stale = await call(ctx, "update_task", { id: "a", version: 1, status: "skip" });
    expect(stale.isError).toBe(true);
    expect(code(stale)).toBe("CONFLICT");
  });

  it("deletes a task and reorders the rest", async () => {
    const ctx = context();
    const removed = await payload(await call(ctx, "delete_task", { id: "a", version: 1 }));
    expect(removed).toEqual({ deleted: "a" });
    const reordered = await payload(await call(ctx, "reorder_tasks", { tasks: [{ id: "b", order: 7 }] }));
    expect(reordered).toMatchObject([{ id: "b", order: 7 }]);
  });

  it("runs the bulk operations", async () => {
    const ctx = context();
    const statuses = await payload(
      await call(ctx, "bulk_update_task_status", { tasks: [{ id: "a", version: 1 }], status: "skip" }),
    );
    expect(statuses).toMatchObject([{ id: "a", status: "skip" }]);
    const moved = await payload(
      await call(ctx, "bulk_update_task_project", { tasks: [{ id: "b", version: 1 }], project: "Yoriwake" }),
    );
    expect(moved).toMatchObject([{ id: "b", project: "Yoriwake" }]);
    expect(code(await call(ctx, "bulk_delete_tasks", { tasks: [] }))).toBe("INVALID_INPUT");
  });

  it("moves a task back to the idea list", async () => {
    const ctx = context();
    const idea = await payload(await call(ctx, "move_task_to_idea", { id: "a", version: 1 }));
    expect(idea).toMatchObject({ title: "alpha" });
    expect(await payload(await call(ctx, "list_tasks"))).toHaveLength(1);
    expect(await payload(await call(ctx, "list_ideas"))).toHaveLength(1);
  });
});

describe("MCP project and idea tools", () => {
  it("creates and updates a project", async () => {
    const ctx = context();
    const created = await payload(await call(ctx, "create_project", { id: "new_project", name: "New Project" }));
    expect(created).toMatchObject({ id: "new_project", name: "New Project", archived: false });
    const updated = await payload(await call(ctx, "update_project", { id: "new_project", archived: true }));
    expect(updated).toMatchObject({ id: "new_project", archived: true });
    expect(code(await call(ctx, "create_project", { id: "bad id!", name: "x" }))).toBe("INVALID_PROJECT_ID");
  });

  it("creates, updates and converts ideas", async () => {
    const ctx = context();
    const idea = await payload(await call(ctx, "create_idea", { title: "memo" }));
    expect(idea).toMatchObject({ title: "memo", pinned: false });
    const id = textOf(recordOf(idea)["id"]);
    const pinned = await payload(await call(ctx, "update_idea", { id, pinned: true }));
    expect(pinned).toMatchObject({ id, pinned: true });
    const task = await payload(await call(ctx, "move_idea_to_task", { id }));
    expect(task).toMatchObject({ title: "memo", status: "do" });
    expect(await payload(await call(ctx, "list_ideas"))).toHaveLength(0);
  });
});

describe("MCP endpoint (BDD-TM-032)", () => {
  function bindings(): Env {
    return { SESSION_SECRET: "mcp-test-secret", OAUTH_REPOSITORY: createMemoryOAuthRepository() };
  }

  it("rejects an unauthenticated call with a challenge", async () => {
    const response = await app.request(
      "/mcp",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      },
      bindings(),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("resource_metadata");
  });

  it("rejects an unauthenticated GET", async () => {
    const response = await app.request("/mcp", { method: "GET" }, bindings());
    expect(response.status).toBe(401);
  });
});
