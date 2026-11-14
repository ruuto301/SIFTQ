import type { Context, Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import {
  applyTaskPatch,
  createTask,
  isRecord,
  isTaskOrderValid,
  isTaskStatus,
  nextTaskOrder,
  parseTaskPatch,
  parseTaskVersionInputs,
} from "../task";
import type { DomainError, Result, Task, TaskStatus, TaskVersionInput } from "../task";
import {
  applyProjectPatch,
  isProjectId,
  isProjectOrderValid,
  nextProjectOrder,
  parseProjectCreate,
  parseProjectPatch,
} from "../project";
import type { TaskRepository } from "../repository/task-repository";
import type { ProjectRepository } from "../repository/project-repository";
import type { IdeaRepository } from "../repository/idea-repository";
import { nextIdeaOrder } from "../idea";
import type { Idea } from "../idea";
import { sortTasksByOrder } from "../task-list";
import { parseVersion } from "../task-input";

type ApiEnv = { Bindings: Record<string, unknown> };
type Repository<T extends ApiEnv> = (c: Context<T>) => TaskRepository;
type ProjectRepositoryFactory<T extends ApiEnv> = (c: Context<T>) => ProjectRepository;
type IdeaRepositoryFactory<T extends ApiEnv> = (c: Context<T>) => IdeaRepository;

type TaskDeps<T extends ApiEnv> = {
  repository: Repository<T>;
  projectRepository: ProjectRepositoryFactory<T>;
};

function problem<T extends ApiEnv>(c: Context<T>, status: ContentfulStatusCode, code: string) {
  return c.json({ code }, status);
}

function bulkProblem<T extends ApiEnv>(c: Context<T>, code: string) {
  return problem(c, code === "NOT_FOUND" ? 404 : 409, code);
}

async function readJsonRecord<T extends ApiEnv>(c: Context<T>): Promise<Record<string, unknown> | null> {
  try {
    const body = await c.req.json<unknown>();
    return isRecord(body) ? body : null;
  } catch {
    return null;
  }
}

type OrderUpdates = { ok: true; updates: { id: string; order: number }[] } | { ok: false; code: string };

/** Parses a non-empty `[{ id, order }]` list with unique ids and orders. */
function readOrderUpdates(value: unknown, isValidOrder: (order: number) => boolean): OrderUpdates {
  if (!Array.isArray(value) || value.length === 0) return { ok: false, code: "INVALID_INPUT" };
  const seenIds = new Set<string>();
  const seenOrders = new Set<number>();
  const updates: { id: string; order: number }[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) return { ok: false, code: "INVALID_INPUT" };
    const id = raw["id"];
    if (typeof id !== "string") return { ok: false, code: "INVALID_INPUT" };
    const order = raw["order"];
    if (typeof order !== "number" || !isValidOrder(order)) return { ok: false, code: "INVALID_ORDER" };
    if (seenIds.has(id)) return { ok: false, code: "INVALID_INPUT" };
    if (seenOrders.has(order)) return { ok: false, code: "INVALID_ORDER" };
    seenIds.add(id);
    seenOrders.add(order);
    updates.push({ id, order });
  }
  return { ok: true, updates };
}

/** Reads the requested insert position; `first` puts the new task at the top of the list. */
function readCreatePosition(value: unknown): "first" | "last" | null {
  if (value === undefined || value === "last") return "last";
  return value === "first" ? "first" : null;
}

/** Shifts every existing task down by one so a new task can take the first position. */
async function shiftTasksForFirstPlace<T extends ApiEnv>(
  c: Context<T>,
  deps: TaskDeps<T>,
  tasks: readonly Task[],
) {
  const updates = tasks
    .map((task) => ({ id: task.id, order: task.order + 1 }))
    .sort((left, right) => right.order - left.order);
  return deps.repository(c).move(updates);
}

function createTaskAtBoundary({
  title,
  description,
  status,
  project,
}: {
  title: string;
  description: string;
  status?: TaskStatus;
  project: string | null;
}) {
  const now = new Date().toISOString();
  return createTask({
    id: crypto.randomUUID(),
    owner_id: "local",
    title,
    description,
    ...(status === undefined ? {} : { status }),
    project,
    created_at: now,
    updated_at: now,
  });
}

type ApiProjectLookup =
  | { ok: true; project: string | null }
  | { ok: false; code: string };

/** Resolves a requested project id against the project repository. */
async function resolveApiProject<T extends ApiEnv>(
  factory: ProjectRepositoryFactory<T>,
  c: Context<T>,
  value: unknown,
): Promise<ApiProjectLookup> {
  if (value === undefined || value === null) return { ok: true, project: null };
  if (!isProjectId(value)) return { ok: false, code: "INVALID_PROJECT" };
  const found = await factory(c).find(value);
  if (!found.ok) return { ok: false, code: found.error.code };
  if (!found.value) return { ok: false, code: "INVALID_PROJECT" };
  return { ok: true, project: value };
}

type ApiTaskLookup =
  | { ok: true; task: Task }
  | { ok: false; status: ContentfulStatusCode; code: string };

async function findApiTask<T extends ApiEnv>(repository: Repository<T>, c: Context<T>, id: string): Promise<ApiTaskLookup> {
  const found = await repository(c).find(id, "local");
  if (!found.ok) return { ok: false, status: 500, code: found.error.code };
  if (!found.value) return { ok: false, status: 404, code: "NOT_FOUND" };
  return { ok: true, task: found.value };
}

type ApiTaskItem =
  | { ok: true; task: Task; version: number; body: Record<string, unknown> }
  | { ok: false; status: ContentfulStatusCode; code: string };

/** Reads the JSON body and the current task for an /api/tasks/:id request. */
async function readApiTaskItem<T extends ApiEnv>(
  repository: Repository<T>,
  c: Context<T>,
): Promise<ApiTaskItem> {
  const body = await c.req.json<Record<string, unknown>>();
  const version = parseVersion(body["version"]);
  if (version === null) return { ok: false, status: 400, code: "INVALID_ORDER" };
  const id = c.req.param("id");
  if (id === undefined) return { ok: false, status: 404, code: "NOT_FOUND" };
  const found = await findApiTask(repository, c, id);
  if (!found.ok) return found;
  return { ok: true, task: found.task, version, body };
}

type ApiBulkInput =
  | { ok: true; body: Record<string, unknown>; inputs: TaskVersionInput[] }
  | { ok: false; code: string };

async function readApiBulkInput<T extends ApiEnv>(c: Context<T>): Promise<ApiBulkInput> {
  const body = await readJsonRecord(c);
  if (body === null) return { ok: false, code: "INVALID_BULK_INPUT" };
  const inputs = parseTaskVersionInputs(body["tasks"]);
  if (!inputs.ok) return { ok: false, code: inputs.error.code };
  return { ok: true, body, inputs: inputs.value };
}

function respondBulk<T extends ApiEnv>(
  c: Context<T>,
  run: () => Promise<Result<Task[], DomainError>>,
) {
  return run().then((result) =>
    result.ok ? c.json(result.value) : bulkProblem(c, result.error.code),
  );
}

async function listApiTasks<T extends ApiEnv>(c: Context<T>, deps: TaskDeps<T>) {
  const result = await deps.repository(c).list();
  if (!result.ok) return problem(c, 500, result.error.code);
  return c.json(result.value);
}

async function getApiTask<T extends ApiEnv>(c: Context<T>, deps: TaskDeps<T>) {
  const result = await deps.repository(c).find(c.req.param("id") ?? "", "local");
  if (!result.ok) return problem(c, 500, result.error.code);
  if (!result.value) return problem(c, 404, "NOT_FOUND");
  return c.json(result.value);
}

async function createApiTask<T extends ApiEnv>(c: Context<T>, deps: TaskDeps<T>) {
  const body = await c.req.json<Record<string, unknown>>();
  const title = typeof body["title"] === "string" ? body["title"].trim() : "";
  const description = typeof body["description"] === "string" ? body["description"] : "";
  const status = body["status"];
  if (status !== undefined && !isTaskStatus(status)) return problem(c, 400, "INVALID_STATUS");
  const project = await resolveApiProject(deps.projectRepository, c, body["project"]);
  if (!project.ok) return problem(c, 400, project.code);
  const position = readCreatePosition(body["position"]);
  if (position === null) return problem(c, 400, "INVALID_INPUT");
  const created = createTaskAtBoundary({
    title,
    description,
    ...(status === undefined ? {} : { status }),
    project: project.project,
  });
  if (!created.ok) return problem(c, 400, created.error.code);
  const listed = await deps.repository(c).list();
  if (!listed.ok) return problem(c, 500, listed.error.code);
  if (position === "first" && listed.value.length > 0) {
    const shifted = await shiftTasksForFirstPlace(c, deps, listed.value);
    if (!shifted.ok) return problem(c, 500, shifted.error.code);
  }
  const inserted = await deps.repository(c).insert({
    ...created.value,
    order: position === "first" ? 1 : nextTaskOrder(listed.value),
  });
  if (!inserted.ok) return problem(c, 500, inserted.error.code);
  c.header("Location", `/api/tasks/${inserted.value.id}`);
  return c.json(inserted.value, 201);
}

async function bulkStatusApiTasks<T extends ApiEnv>(c: Context<T>, deps: TaskDeps<T>) {
  const input = await readApiBulkInput(c);
  if (!input.ok) return problem(c, 400, input.code);
  const status = input.body["status"];
  if (!isTaskStatus(status)) return problem(c, 400, "INVALID_STATUS");
  return respondBulk(c, () => deps.repository(c).bulkUpdateStatus(input.inputs, status));
}

async function bulkProjectApiTasks<T extends ApiEnv>(c: Context<T>, deps: TaskDeps<T>) {
  const input = await readApiBulkInput(c);
  if (!input.ok) return problem(c, 400, input.code);
  const project = await resolveApiProject(deps.projectRepository, c, input.body["project"]);
  if (!project.ok) return problem(c, 400, project.code);
  return respondBulk(c, () => deps.repository(c).bulkUpdateProject(input.inputs, project.project));
}

async function bulkDeleteApiTasks<T extends ApiEnv>(c: Context<T>, deps: TaskDeps<T>) {
  const input = await readApiBulkInput(c);
  if (!input.ok) return problem(c, 400, input.code);
  const result = await deps.repository(c).bulkRemove(input.inputs);
  if (!result.ok) return bulkProblem(c, result.error.code);
  return c.body(null, 204);
}

async function patchApiTask<T extends ApiEnv>(c: Context<T>, deps: TaskDeps<T>) {
  const item = await readApiTaskItem(deps.repository, c);
  if (!item.ok) return problem(c, item.status, item.code);
  const parsed = parseTaskPatch(item.body);
  if (!parsed.ok) return problem(c, 400, parsed.error.code);
  if ("project" in parsed.value) {
    const project = await resolveApiProject(deps.projectRepository, c, parsed.value.project);
    if (!project.ok) return problem(c, 400, project.code);
    parsed.value.project = project.project;
  }
  const patched = applyTaskPatch(item.task, parsed.value);
  const updated = await deps.repository(c).update({ ...patched, version: item.version });
  if (!updated.ok) return problem(c, 409, updated.error.code);
  return c.json(updated.value);
}

async function deleteApiTask<T extends ApiEnv>(c: Context<T>, deps: TaskDeps<T>) {
  const item = await readApiTaskItem(deps.repository, c);
  if (!item.ok) return problem(c, item.status, item.code);
  const removed = await deps.repository(c).remove(item.task.id, "local", item.version);
  if (!removed.ok) {
    return removed.error.code === "CONFLICT"
      ? problem(c, 409, removed.error.code)
      : problem(c, 404, removed.error.code);
  }
  return c.body(null, 204);
}

async function moveApiTaskToIdea<T extends ApiEnv>(
  c: Context<T>,
  deps: TaskDeps<T>,
  ideaRepository: IdeaRepositoryFactory<T>,
) {
  const item = await readApiTaskItem(deps.repository, c);
  if (!item.ok) return problem(c, item.status, item.code);
  const ideas = await ideaRepository(c).list("local");
  if (!ideas.ok) return problem(c, 500, ideas.error.code);
  const idea: Idea = {
    id: crypto.randomUUID(),
    owner_id: "local",
    title: item.task.title,
    description: item.task.description,
    order: nextIdeaOrder(ideas.value, false),
    pinned: false,
  };
  const inserted = await ideaRepository(c).insert(idea);
  if (!inserted.ok) return problem(c, 500, inserted.error.code);
  const removed = await deps.repository(c).remove(item.task.id, "local", item.version);
  if (!removed.ok) {
    await ideaRepository(c).remove(inserted.value.id, "local");
    return removed.error.code === "CONFLICT"
      ? problem(c, 409, removed.error.code)
      : problem(c, 404, removed.error.code);
  }
  return c.json(inserted.value, 200);
}

async function reorderApiTasks<T extends ApiEnv>(c: Context<T>, deps: TaskDeps<T>) {
  const body = await readJsonRecord(c);
  const updates = readOrderUpdates(body?.["tasks"], isTaskOrderValid);
  if (!updates.ok) return problem(c, 400, updates.code);

  const moved = await deps.repository(c).move(updates.updates);
  if (!moved.ok) return problem(c, moved.error.code === "NOT_FOUND" ? 400 : 500, moved.error.code);
  return c.json(sortTasksByOrder(moved.value));
}

function registerTaskRoutes<T extends ApiEnv>(app: Hono<T>, deps: TaskDeps<T>) {
  app.get("/api/tasks", (c) => listApiTasks(c, deps));
  app.get("/api/tasks/:id", (c) => getApiTask(c, deps));
  app.post("/api/tasks", (c) => createApiTask(c, deps));
  app.post("/api/tasks/reorder", (c) => reorderApiTasks(c, deps));
  app.patch("/api/tasks/bulk/status", (c) => bulkStatusApiTasks(c, deps));
  app.patch("/api/tasks/bulk/project", (c) => bulkProjectApiTasks(c, deps));
  app.delete("/api/tasks/bulk", (c) => bulkDeleteApiTasks(c, deps));
  app.patch("/api/tasks/:id", (c) => patchApiTask(c, deps));
  app.delete("/api/tasks/:id", (c) => deleteApiTask(c, deps));
}

async function createApiProject<T extends ApiEnv>(
  c: Context<T>,
  projectRepository: ProjectRepositoryFactory<T>,
) {
  const body = await readJsonRecord(c);
  if (body === null) return problem(c, 400, "INVALID_INPUT");
  const input = parseProjectCreate(body);
  if (!input.ok) return problem(c, 400, "INVALID_INPUT");

  const listed = await projectRepository(c).list();
  if (!listed.ok) return problem(c, 500, listed.error.code);
  const created = await projectRepository(c).insert({
    ...input.value,
    sort_order: nextProjectOrder(listed.value),
  });
  if (!created.ok) {
    return created.error.code === "CONFLICT"
      ? problem(c, 409, "CONFLICT")
      : problem(c, 500, created.error.code);
  }
  c.header("Location", `/api/projects/${created.value.id}`);
  return c.json(created.value, 201);
}

async function patchApiProject<T extends ApiEnv>(
  c: Context<T>,
  projectRepository: ProjectRepositoryFactory<T>,
) {
  const id = c.req.param("id");
  if (id === undefined || !isProjectId(id)) return problem(c, 404, "NOT_FOUND");
  const body = await readJsonRecord(c);
  if (body === null) return problem(c, 400, "INVALID_INPUT");
  const patch = parseProjectPatch(body);
  if (!patch.ok) return problem(c, 400, "INVALID_INPUT");

  const found = await projectRepository(c).find(id);
  if (!found.ok) return problem(c, 500, found.error.code);
  if (!found.value) return problem(c, 404, "NOT_FOUND");
  const updated = await projectRepository(c).update(applyProjectPatch(found.value, patch.value));
  if (!updated.ok) {
    return updated.error.code === "NOT_FOUND"
      ? problem(c, 404, "NOT_FOUND")
      : problem(c, 500, updated.error.code);
  }
  return c.json(updated.value);
}

function registerProjectRoutes<T extends ApiEnv>(
  app: Hono<T>,
  projectRepository: ProjectRepositoryFactory<T>,
) {
  app.get("/api/projects", async (c) => {
    const result = await projectRepository(c).list();
    if (!result.ok) return problem(c, 500, result.error.code);
    return c.json(result.value);
  });

  app.post("/api/projects", (c) => createApiProject(c, projectRepository));

  app.patch("/api/projects/:id", (c) => patchApiProject(c, projectRepository));

  app.post("/api/projects/reorder", async (c) => {
    const body = await readJsonRecord(c);
    const updates = readOrderUpdates(body?.["projects"], isProjectOrderValid);
    if (!updates.ok) return problem(c, 400, updates.code);
    const moved = await projectRepository(c).move(updates.updates);
    if (!moved.ok) return problem(c, moved.error.code === "INVALID_PROJECT" ? 400 : 500, moved.error.code);
    return c.json(moved.value);
  });
}

export function registerTaskApiRoutes<T extends ApiEnv>(
  app: Hono<T>,
  repository: Repository<T>,
  ideaRepository: IdeaRepositoryFactory<T>,
  projectRepository: ProjectRepositoryFactory<T>,
) {
  const deps: TaskDeps<T> = { repository, projectRepository };
  registerProjectRoutes(app, projectRepository);
  registerTaskRoutes(app, deps);
  app.post("/api/tasks/:id/move-to-idea", (c) => moveApiTaskToIdea(c, deps, ideaRepository));
}
