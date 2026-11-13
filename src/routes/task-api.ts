import type { Context, Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import {
  applyTaskPatch,
  createTask,
  isRecord,
  isTaskStatus,
  nextTaskOrder,
  parseTaskPatch,
  parseTaskVersionInputs,
} from "../task";
import type { Task } from "../task";
import { isProjectId } from "../project";
import type { TaskRepository } from "../repository/task-repository";
import type { ProjectRepository } from "../repository/project-repository";
import type { IdeaRepository } from "../repository/idea-repository";
import { nextIdeaOrder } from "../idea";
import type { Idea } from "../idea";
import { parseVersion } from "../task-input";

type ApiEnv = { Bindings: Record<string, unknown> };
type Repository<T extends ApiEnv> = (c: Context<T>) => TaskRepository;
type ProjectRepositoryFactory<T extends ApiEnv> = (c: Context<T>) => ProjectRepository;
type IdeaRepositoryFactory<T extends ApiEnv> = (c: Context<T>) => IdeaRepository;

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

function createTaskAtBoundary({
  title,
  description,
  project,
}: {
  title: string;
  description: string;
  project: string | null;
}) {
  const now = new Date().toISOString();
  return createTask({
    id: crypto.randomUUID(),
    owner_id: "local",
    title,
    description,
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

function registerTaskCollectionRoutes<T extends ApiEnv>(
  app: Hono<T>,
  repository: Repository<T>,
  projectRepository: ProjectRepositoryFactory<T>,
) {
  app.get("/api/tasks", async (c) => {
    const result = await repository(c).list();
    if (!result.ok) return problem(c, 500, result.error.code);
    return c.json(result.value);
  });

  app.get("/api/tasks/:id", async (c) => {
    const result = await repository(c).find(c.req.param("id"), "local");
    if (!result.ok) return problem(c, 500, result.error.code);
    if (!result.value) return problem(c, 404, "NOT_FOUND");
    return c.json(result.value);
  });

  app.post("/api/tasks", async (c) => {
    const body = await c.req.json<Record<string, unknown>>();
    const title = typeof body["title"] === "string" ? body["title"].trim() : "";
    const description = typeof body["description"] === "string" ? body["description"] : "";
    const project = await resolveApiProject(projectRepository, c, body["project"]);
    if (!project.ok) return problem(c, 400, project.code);
    const created = createTaskAtBoundary({ title, description, project: project.project });
    if (!created.ok) return problem(c, 400, created.error.code);
    const listed = await repository(c).list();
    if (!listed.ok) return problem(c, 500, listed.error.code);
    const inserted = await repository(c).insert({ ...created.value, order: nextTaskOrder(listed.value) });
    if (!inserted.ok) return problem(c, 500, inserted.error.code);
    c.header("Location", `/api/tasks/${inserted.value.id}`);
    return c.json(inserted.value, 201);
  });

}

function registerTaskBulkRoutes<T extends ApiEnv>(
  app: Hono<T>,
  repository: Repository<T>,
  projectRepository: ProjectRepositoryFactory<T>,
) {
  app.patch("/api/tasks/bulk/status", async (c) => {
    const body = await readJsonRecord(c);
    if (body === null) return problem(c, 400, "INVALID_BULK_INPUT");
    const status = body["status"];
    const inputs = parseTaskVersionInputs(body["tasks"]);
    if (!isTaskStatus(status)) return problem(c, 400, "INVALID_STATUS");
    if (!inputs.ok) return problem(c, 400, inputs.error.code);
    const result = await repository(c).bulkUpdateStatus(inputs.value, status);
    if (!result.ok) return bulkProblem(c, result.error.code);
    return c.json(result.value);
  });

  app.patch("/api/tasks/bulk/project", async (c) => {
    const body = await readJsonRecord(c);
    if (body === null) return problem(c, 400, "INVALID_BULK_INPUT");
    const inputs = parseTaskVersionInputs(body["tasks"]);
    if (!inputs.ok) return problem(c, 400, inputs.error.code);
    const project = await resolveApiProject(projectRepository, c, body["project"]);
    if (!project.ok) return problem(c, 400, project.code);
    const result = await repository(c).bulkUpdateProject(inputs.value, project.project);
    if (!result.ok) return bulkProblem(c, result.error.code);
    return c.json(result.value);
  });

  app.delete("/api/tasks/bulk", async (c) => {
    const body = await readJsonRecord(c);
    if (body === null) return problem(c, 400, "INVALID_BULK_INPUT");
    const inputs = parseTaskVersionInputs(body["tasks"]);
    if (!inputs.ok) return problem(c, 400, inputs.error.code);
    const result = await repository(c).bulkRemove(inputs.value);
    if (!result.ok) return bulkProblem(c, result.error.code);
    return c.body(null, 204);
  });

}

function registerTaskItemRoutes<T extends ApiEnv>(
  app: Hono<T>,
  repository: Repository<T>,
  projectRepository: ProjectRepositoryFactory<T>,
) {
  app.patch("/api/tasks/:id", async (c) => {
    const body = await c.req.json<Record<string, unknown>>();
    const found = await findApiTask(repository, c, c.req.param("id"));
    if (!found.ok) return problem(c, found.status, found.code);
    const parsed = parseTaskPatch(body);
    if (!parsed.ok) return problem(c, 400, parsed.error.code);
    if ("project" in parsed.value) {
      const project = await resolveApiProject(projectRepository, c, parsed.value.project);
      if (!project.ok) return problem(c, 400, project.code);
      parsed.value.project = project.project;
    }
    const patched = applyTaskPatch(found.task, parsed.value);
    const version = parseVersion(body["version"]);
    if (version === null) return problem(c, 400, "INVALID_ORDER");
    const updated = await repository(c).update({ ...patched, version });
    if (!updated.ok) return problem(c, 409, updated.error.code);
    return c.json(updated.value);
  });

  app.delete("/api/tasks/:id", async (c) => {
    const body = await c.req.json<Record<string, unknown>>();
    const version = parseVersion(body["version"]);
    if (version === null) return problem(c, 400, "INVALID_ORDER");
    const found = await findApiTask(repository, c, c.req.param("id"));
    if (!found.ok) return problem(c, found.status, found.code);
    const removed = await repository(c).remove(found.task.id, "local", version);
    if (!removed.ok) {
      return removed.error.code === "CONFLICT"
        ? problem(c, 409, removed.error.code)
        : problem(c, 404, removed.error.code);
    }
    return c.body(null, 204);
  });

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
}

function registerTaskMoveRoute<T extends ApiEnv>(
  app: Hono<T>,
  repository: Repository<T>,
  ideaRepository: IdeaRepositoryFactory<T>,
) {
  app.post("/api/tasks/:id/move-to-idea", async (c) => {
    const body = await readJsonRecord(c);
    if (body === null) return problem(c, 400, "INVALID_ORDER");
    const version = parseVersion(body["version"]);
    if (version === null) return problem(c, 400, "INVALID_ORDER");
    const found = await findApiTask(repository, c, c.req.param("id"));
    if (!found.ok) return problem(c, found.status, found.code);
    const ideas = await ideaRepository(c).list("local");
    if (!ideas.ok) return problem(c, 500, ideas.error.code);
    const idea: Idea = {
      id: crypto.randomUUID(),
      owner_id: "local",
      title: found.task.title,
      description: found.task.description,
      order: nextIdeaOrder(ideas.value, false),
      pinned: false,
    };
    const inserted = await ideaRepository(c).insert(idea);
    if (!inserted.ok) return problem(c, 500, inserted.error.code);
    const removed = await repository(c).remove(found.task.id, "local", version);
    if (!removed.ok) {
      await ideaRepository(c).remove(inserted.value.id, "local");
      return removed.error.code === "CONFLICT"
        ? problem(c, 409, removed.error.code)
        : problem(c, 404, removed.error.code);
    }
    return c.json(inserted.value, 200);
  });
}

export function registerTaskApiRoutes<T extends ApiEnv>(
  app: Hono<T>,
  repository: Repository<T>,
  ideaRepository: IdeaRepositoryFactory<T>,
  projectRepository: ProjectRepositoryFactory<T>,
) {
  registerProjectRoutes(app, projectRepository);
  registerTaskCollectionRoutes(app, repository, projectRepository);
  registerTaskBulkRoutes(app, repository, projectRepository);
  registerTaskItemRoutes(app, repository, projectRepository);
  registerTaskMoveRoute(app, repository, ideaRepository);
}
