import {
  applyTaskPatch,
  createTask,
  isTaskStatus,
  isTaskTitleValid,
  isTaskDescriptionValid,
  nextTaskOrder,
  parseTaskPatch,
} from "../task";
import type { Task, TaskStatus } from "../task";
import { sortTasksByOrder, taskTextFilter, taskWorkingFilter } from "../task-list";
import { createIdea as buildIdea } from "../idea-tasks";
import { findById, findVersioned, isToolResult, readVersionedInput, removeContent, updateContent } from "./helpers";
import { errorContent, jsonContent, repositoryError, type McpTool, type ToolContext, type ToolResult } from "./types";
import { TASK_STATUS_SCHEMA, readOptionalBoolean, readOptionalNumber, readOrderUpdates, readString, readVersionInputs, schema } from "./schema";

const OWNER_ID = "local";
const LIST_LIMIT_MAX = 200;

const ID_VERSION_PROPERTIES = {
  id: { type: "string" },
  version: { type: "integer" },
};

function nowIso(): string {
  return new Date().toISOString();
}

async function loadTasks(ctx: ToolContext): Promise<Task[] | ToolResult> {
  const listed = await ctx.tasks.list();
  if (!listed.ok) return errorContent(listed.error.code, "failed to load tasks");
  return listed.value;
}

type TaskListFilters = {
  status: TaskStatus | undefined;
  project: string | null;
  query: string | null;
  working: boolean | null;
  limit: number | null;
};

function readListFilters(args: Record<string, unknown>): TaskListFilters | ToolResult {
  const status = args["status"];
  if (status !== undefined && !isTaskStatus(status)) return errorContent("INVALID_STATUS", "status must be do, done or skip");
  const project = readString(args, "project");
  if (args["project"] !== undefined && project === null) return errorContent("INVALID_PROJECT", "project must be a string");
  const query = readString(args, "query");
  if (args["query"] !== undefined && query === null) return errorContent("INVALID_INPUT", "query must be a string");
  const working = readOptionalBoolean(args, "working");
  if (args["working"] !== undefined && working === null) return errorContent("INVALID_INPUT", "working must be a boolean");
  const limit = readOptionalNumber(args, "limit");
  if (limit !== null && (limit <= 0 || limit > LIST_LIMIT_MAX)) {
    return errorContent("INVALID_INPUT", `limit must be between 1 and ${LIST_LIMIT_MAX}`);
  }
  return { status: isTaskStatus(status) ? status : undefined, project, query, working, limit };
}

function applyListFilters(tasks: readonly Task[], filters: TaskListFilters): Task[] {
  let filtered = sortTasksByOrder(tasks);
  if (filters.status !== undefined) filtered = filtered.filter((task) => task.status === filters.status);
  if (filters.project !== null) filtered = filtered.filter((task) => (task.project ?? "") === filters.project);
  if (filters.query !== null && filters.query.trim() !== "") filtered = filtered.filter(taskTextFilter(filters.query));
  if (filters.working !== null) filtered = filtered.filter(taskWorkingFilter(filters.working ? "on" : "off"));
  return filters.limit === null ? filtered : filtered.slice(0, filters.limit);
}

const listTasks: McpTool = {
  name: "list_tasks",
  description: "List tasks ordered by their stored order. Optional filters: status, project, query (text), working, limit.",
  scope: "read",
  inputSchema: schema(
    {
      status: TASK_STATUS_SCHEMA,
      project: { type: "string", description: "project id, or empty string for unassigned" },
      query: { type: "string", description: "text matched against the task title and description" },
      working: { type: "boolean" },
      limit: { type: "integer", minimum: 1, maximum: LIST_LIMIT_MAX },
    },
  ),
  handler: async (ctx, args) => {
    const tasks = await loadTasks(ctx);
    if (!Array.isArray(tasks)) return tasks;
    const filters = readListFilters(args);
    if ("content" in filters) return filters;
    return jsonContent(applyListFilters(tasks, filters));
  },
};

const getTask: McpTool = {
  name: "get_task",
  description: "Fetch one task by id. The response includes the version required for updates.",
  scope: "read",
  inputSchema: schema({ id: { type: "string" } }, ["id"]),
  handler: async (ctx, args) => {
    const found = await findById(args, "failed to load the task", (id) => ctx.tasks.find(id, OWNER_ID));
    if (isToolResult(found)) return found;
    return jsonContent(found);
  },
};

const taskSummary: McpTool = {
  name: "task_summary",
  description: "Count tasks by status and by project. Useful as a first call to understand the board.",
  scope: "read",
  inputSchema: schema({}),
  handler: async (ctx) => {
    const tasks = await loadTasks(ctx);
    if (!Array.isArray(tasks)) return tasks;
    const byStatus: Record<string, number> = { do: 0, done: 0, skip: 0 };
    const byProject: Record<string, number> = {};
    let working = 0;
    for (const task of tasks) {
      byStatus[task.status] = (byStatus[task.status] ?? 0) + 1;
      const project = task.project ?? "";
      byProject[project] = (byProject[project] ?? 0) + 1;
      if (task.working) working += 1;
    }
    return jsonContent({ total: tasks.length, working, by_status: byStatus, by_project: byProject });
  },
};

type CreateTaskInputResult =
  | { ok: false; error: string }
  | {
      ok: true;
      value: {
        title: string;
        description: string;
        status: TaskStatus | undefined;
        project: string | null;
        first: boolean;
      };
    };

function readCreateTaskInput(args: Record<string, unknown>): CreateTaskInputResult {
  const title = readString(args, "title");
  if (title === null || !isTaskTitleValid(title.trim())) return { ok: false, error: "INVALID_TITLE" };
  const description = readString(args, "description") ?? "";
  if (!isTaskDescriptionValid(description)) return { ok: false, error: "INVALID_DESCRIPTION" };
  const status = args["status"];
  if (status !== undefined && !isTaskStatus(status)) return { ok: false, error: "INVALID_STATUS" };
  const project = args["project"];
  if (project !== undefined && project !== null && typeof project !== "string") {
    return { ok: false, error: "INVALID_PROJECT" };
  }
  const position = args["position"];
  if (position !== undefined && position !== "first" && position !== "last") {
    return { ok: false, error: "INVALID_INPUT" };
  }
  return {
    ok: true,
    value: {
      title: title.trim(),
      description,
      status: isTaskStatus(status) ? status : undefined,
      project: typeof project === "string" ? project : null,
      first: position === "first",
    },
  };
}

const createTaskTool: McpTool = {
  name: "create_task",
  description: "Create a task. Use position \"first\" to put it at the top of the list.",
  scope: "write",
  inputSchema: schema(
    {
      title: { type: "string" },
      description: { type: "string" },
      status: TASK_STATUS_SCHEMA,
      project: { type: ["string", "null"] },
      position: { type: "string", enum: ["first", "last"] },
    },
    ["title"],
  ),
  handler: async (ctx, args) => {
    const input = readCreateTaskInput(args);
    if (!input.ok) return errorContent(input.error, "invalid create_task arguments");
    const tasks = await loadTasks(ctx);
    if (!Array.isArray(tasks)) return tasks;
    if (input.value.first && tasks.length > 0) {
      const shifted = await ctx.tasks.move(
        tasks.map((task) => ({ id: task.id, order: task.order + 1 })).sort((left, right) => right.order - left.order),
      );
      if (!shifted.ok) return errorContent(shifted.error.code, "failed to shift the task order");
    }
    const created = createTask({
      id: crypto.randomUUID(),
      owner_id: OWNER_ID,
      title: input.value.title,
      description: input.value.description,
      ...(input.value.status === undefined ? {} : { status: input.value.status }),
      project: input.value.project,
      created_at: nowIso(),
      updated_at: nowIso(),
    });
    if (!created.ok) return errorContent(created.error.code, "invalid task");
    const order = input.value.first ? 1 : nextTaskOrder(tasks);
    const inserted = await ctx.tasks.insert({ ...created.value, order });
    if (!inserted.ok) return errorContent(inserted.error.code, "failed to insert the task");
    return jsonContent(inserted.value);
  },
};

const updateTask: McpTool = {
  name: "update_task",
  description: "Update a task. version is required; a mismatch means the task changed on the server (fetch it again).",
  scope: "write",
  inputSchema: schema(
    {
      ...ID_VERSION_PROPERTIES,
      title: { type: "string" },
      description: { type: "string" },
      status: TASK_STATUS_SCHEMA,
      project: { type: ["string", "null"] },
      working: { type: "boolean" },
    },
    ["id", "version"],
  ),
  handler: async (ctx, args) => {
    const found = await findVersioned(args, "failed to load the task", (input) => ctx.tasks.find(input.id, OWNER_ID));
    if (isToolResult(found)) return found;
    const parsed = parseTaskPatch(args);
    if (!parsed.ok) return errorContent(parsed.error.code, "invalid update_task arguments");
    return updateContent(ctx.tasks.update({ ...applyTaskPatch(found.value, parsed.value), version: found.input.version }));
  },
};

const deleteTask: McpTool = {
  name: "delete_task",
  description: "Delete a task. version is required. This cannot be undone.",
  scope: "write",
  inputSchema: schema(ID_VERSION_PROPERTIES, ["id", "version"]),
  handler: async (ctx, args) => {
    const input = readVersionedInput(args);
    if (isToolResult(input)) return input;
    return removeContent(input.id, ctx.tasks.remove(input.id, OWNER_ID, input.version));
  },
};

const reorderTasks: McpTool = {
  name: "reorder_tasks",
  description: "Replace the order of the given tasks. Each entry needs id and order (1-based).",
  scope: "write",
  inputSchema: schema({ tasks: { type: "array", items: { type: "object" } } }, ["tasks"]),
  handler: async (ctx, args) => {
    const updates = readOrderUpdates(args["tasks"]);
    if (updates === null) return errorContent("INVALID_INPUT", "tasks must be a non-empty list of {id, order}");
    const moved = await ctx.tasks.move(updates);
    if (!moved.ok) return repositoryError(moved.error.code);
    return jsonContent(sortTasksByOrder(moved.value));
  },
};

async function bulkEdit(ctx: ToolContext, args: Record<string, unknown>, mode: "status" | "project" | "delete"): Promise<ToolResult> {
  const inputs = readVersionInputs(args["tasks"]);
  if (inputs === null) return errorContent("INVALID_INPUT", "tasks must be a non-empty list of {id, version}");
  if (mode === "delete") {
    const removed = await ctx.tasks.bulkRemove(inputs);
    if (!removed.ok) return repositoryError(removed.error.code);
    return jsonContent({ deleted: inputs.length });
  }
  if (mode === "status") {
    const status = args["status"];
    if (!isTaskStatus(status)) return errorContent("INVALID_STATUS", "status must be do, done or skip");
    const updated = await ctx.tasks.bulkUpdateStatus(inputs, status);
    if (!updated.ok) return repositoryError(updated.error.code);
    return jsonContent(updated.value);
  }
  const project = args["project"];
  if (project !== null && typeof project !== "string") return errorContent("INVALID_PROJECT", "project must be a string or null");
  const updated = await ctx.tasks.bulkUpdateProject(inputs, project);
  if (!updated.ok) return repositoryError(updated.error.code);
  return jsonContent(updated.value);
}

const bulkStatus: McpTool = {
  name: "bulk_update_task_status",
  description: "Change the status of up to 50 tasks at once.",
  scope: "write",
  inputSchema: schema({ tasks: { type: "array", items: { type: "object" } }, status: TASK_STATUS_SCHEMA }, ["tasks", "status"]),
  handler: async (ctx, args) => bulkEdit(ctx, args, "status"),
};

const bulkProject: McpTool = {
  name: "bulk_update_task_project",
  description: "Move up to 50 tasks to a project (null clears the project).",
  scope: "write",
  inputSchema: schema({ tasks: { type: "array", items: { type: "object" } }, project: { type: ["string", "null"] } }, ["tasks", "project"]),
  handler: async (ctx, args) => bulkEdit(ctx, args, "project"),
};

const bulkDelete: McpTool = {
  name: "bulk_delete_tasks",
  description: "Delete up to 50 tasks at once. This cannot be undone.",
  scope: "write",
  inputSchema: schema({ tasks: { type: "array", items: { type: "object" } } }, ["tasks"]),
  handler: async (ctx, args) => bulkEdit(ctx, args, "delete"),
};

const moveTaskToIdea: McpTool = {
  name: "move_task_to_idea",
  description: "Move a task back to the idea list. version is required.",
  scope: "write",
  inputSchema: schema(ID_VERSION_PROPERTIES, ["id", "version"]),
  handler: async (ctx, args) => {
    const found = await findVersioned(args, "failed to load the task", (input) => ctx.tasks.find(input.id, OWNER_ID));
    if (isToolResult(found)) return found;
    const ideas = await ctx.ideas.list(OWNER_ID);
    if (!ideas.ok) return errorContent(ideas.error.code, "failed to load ideas");
    const idea = buildIdea(ideas.value, { title: found.value.title, description: found.value.description, pinned: false });
    const inserted = await ctx.ideas.insert(idea);
    if (!inserted.ok) return errorContent(inserted.error.code, "failed to insert the idea");
    const removed = await ctx.tasks.remove(found.input.id, OWNER_ID, found.input.version);
    if (!removed.ok) {
      await ctx.ideas.remove(inserted.value.id, OWNER_ID);
      return repositoryError(removed.error.code);
    }
    return jsonContent(inserted.value);
  },
};

export const TASK_TOOLS: McpTool[] = [
  listTasks,
  getTask,
  taskSummary,
  createTaskTool,
  updateTask,
  deleteTask,
  reorderTasks,
  bulkStatus,
  bulkProject,
  bulkDelete,
  moveTaskToIdea,
];
