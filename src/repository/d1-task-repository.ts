import type { D1Database, D1PreparedStatement, D1Result } from "@cloudflare/workers-types";
import { changeTaskProjects, changeTaskStatuses, err, isTaskProject, isTaskStatus, ok } from "../task";
import type { Result, Task, TaskStatus, TaskVersionInput } from "../task";
import { validateBulkTasks } from "./repository-validation";
import type { RepositoryError, TaskOrderInput, TaskRepository } from "./task-repository";

const OWNER_ID = "local";

export const TASK_COLUMN_NAMES = [
  "id",
  "owner_id",
  "title",
  "description",
  "status",
  "working",
  "project",
  '"order"',
  "version",
  "created_at",
  "updated_at",
] as const;

const TASK_COLUMNS = TASK_COLUMN_NAMES.join(", ");
const TASK_PLACEHOLDERS = TASK_COLUMN_NAMES.map(() => "?").join(", ");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function toTask(value: unknown): Task | undefined {
  if (!isRecord(value)) return undefined;

  const { id, owner_id, title, description, status, working, project, order, version, created_at, updated_at } =
    value;

  if (
    typeof id !== "string" ||
    typeof owner_id !== "string" ||
    typeof title !== "string" ||
    typeof description !== "string" ||
    !isTaskStatus(status) ||
    (working !== 0 && working !== 1) ||
    !isTaskProject(project) ||
    typeof order !== "number" ||
    typeof version !== "number" ||
    typeof created_at !== "string" ||
    typeof updated_at !== "string"
  ) {
    return undefined;
  }

  return {
    id,
    owner_id,
    title,
    description,
    status,
    working: working === 1,
    project,
    order,
    version,
    created_at,
    updated_at,
  };
}

function changes(result: D1Result): number {
  return result.meta?.changes ?? 0;
}

export function createD1TaskRepository(db: D1Database): TaskRepository {
  return {
    list: () => listTasks(db),
    find: (id, owner_id) => findTask(db, id, owner_id),
    insert: (task) => insertTask(db, task),
    update: (task) => updateTask(db, task),
    remove: (id, owner_id, version) => removeTask(db, id, owner_id, version),
    move: (inputs) => moveTasks(db, inputs),
    bulkUpdateStatus: (inputs, status) => bulkUpdateStatus(db, inputs, status),
    bulkUpdateProject: (inputs, project) => bulkUpdateProject(db, inputs, project),
    bulkRemove: (inputs) => bulkRemove(db, inputs),
    clearProject: (projectId) => clearProject(db, projectId),
  };
}

type BulkBinder = (task: Task, updatedAt: string) => readonly unknown[];
type BulkChange = (tasks: readonly Task[], updatedAt: string) => Result<Task[], RepositoryError>;

async function bulkUpdateTasks(
  db: D1Database,
  inputs: readonly TaskVersionInput[],
  sql: string,
  bind: BulkBinder,
  change: BulkChange,
): Promise<Result<Task[], RepositoryError>> {
  const current = await findBulkTasks(db, inputs);
  if (!current.ok) return current;

  const updatedAt = new Date().toISOString();
  const executed = await executeBulk(db, current.value, (task) =>
    db.prepare(sql).bind(...bind(task, updatedAt)),
  );
  if (!executed.ok) return executed;

  return change(current.value, updatedAt);
}

async function bulkUpdateStatus(
  db: D1Database,
  inputs: readonly TaskVersionInput[],
  status: TaskStatus,
): Promise<Result<Task[], RepositoryError>> {
  return bulkUpdateTasks(
    db,
    inputs,
    "UPDATE tasks SET status = ?, version = version + 1, updated_at = ? WHERE id = ? AND owner_id = ? AND version = ?",
    (task, updatedAt) => [status, updatedAt, task.id, OWNER_ID, task.version],
    (tasks, updatedAt) => changeTaskStatuses(tasks, status, updatedAt),
  );
}

async function bulkUpdateProject(
  db: D1Database,
  inputs: readonly TaskVersionInput[],
  project: string | null,
): Promise<Result<Task[], RepositoryError>> {
  return bulkUpdateTasks(
    db,
    inputs,
    "UPDATE tasks SET project = ?, version = version + 1, updated_at = ? WHERE id = ? AND owner_id = ? AND version = ?",
    (task, updatedAt) => [project, updatedAt, task.id, OWNER_ID, task.version],
    (tasks, updatedAt) => changeTaskProjects(tasks, project, updatedAt),
  );
}

async function clearProject(
  db: D1Database,
  projectId: string,
): Promise<Result<number, RepositoryError>> {
  const result = await db
    .prepare("UPDATE tasks SET project = NULL WHERE project = ? AND owner_id = ?")
    .bind(projectId, OWNER_ID)
    .run();
  if (!result.success) return err({ code: "NOT_FOUND" });
  return ok(result.meta.changes ?? 0);
}

async function listTasks(db: D1Database): Promise<Result<Task[], RepositoryError>> {
  const result = await db
    .prepare(
      `SELECT ${TASK_COLUMNS} FROM tasks WHERE owner_id = ? ORDER BY updated_at DESC, id ASC`,
    )
    .bind(OWNER_ID)
    .all<Record<string, unknown>>();

  return ok(result.results.map(toTask).filter((task): task is Task => task !== undefined));
}

async function findTask(
  db: D1Database,
  id: string,
  owner_id: string,
): Promise<Result<Task | undefined, RepositoryError>> {
  const row = await db
    .prepare(
      `SELECT ${TASK_COLUMNS} FROM tasks WHERE id = ? AND owner_id = ?`,
    )
    .bind(id, owner_id)
    .first<Record<string, unknown>>();

  return ok(row === null ? undefined : toTask(row));
}

async function insertTask(db: D1Database, task: Task): Promise<Result<Task, RepositoryError>> {
  await db
    .prepare(
      `INSERT INTO tasks (${TASK_COLUMNS}) VALUES (${TASK_PLACEHOLDERS})`,
    )
    .bind(
      task.id,
      OWNER_ID,
      task.title,
      task.description,
      task.status,
      task.working ? 1 : 0,
      task.project,
      task.order,
      task.version,
      task.created_at,
      task.updated_at,
    )
    .run();

  return ok(task);
}

async function updateTask(db: D1Database, task: Task): Promise<Result<Task, RepositoryError>> {
  const updatedAt = new Date().toISOString();
  const result = await db
    .prepare(
      'UPDATE tasks SET title = ?, description = ?, status = ?, working = ?, project = ?, "order" = ?, version = version + 1, updated_at = ? WHERE id = ? AND owner_id = ? AND version = ?',
    )
    .bind(
      task.title,
      task.description,
      task.status,
      task.working ? 1 : 0,
      task.project,
      task.order,
      updatedAt,
      task.id,
      OWNER_ID,
      task.version,
    )
    .run();

  if (changes(result) === 0) return err({ code: "CONFLICT" });
  return ok({ ...task, version: task.version + 1, updated_at: updatedAt });
}

async function bulkRemove(
  db: D1Database,
  inputs: readonly TaskVersionInput[],
): Promise<Result<null, RepositoryError>> {
  const current = await findBulkTasks(db, inputs);
  if (!current.ok) return current;

  const executed = await executeBulk(db, current.value, (task) =>
    db
      .prepare("DELETE FROM tasks WHERE id = ? AND owner_id = ? AND version = ?")
      .bind(task.id, OWNER_ID, task.version),
  );
  if (!executed.ok) return executed;
  return ok(null);
}

async function removeTask(
  db: D1Database,
  id: string,
  owner_id: string,
  version: number,
): Promise<Result<null, RepositoryError>> {
  const found = await findTask(db, id, owner_id);
  if (!found.ok) return err(found.error);
  if (!found.value) return err({ code: "NOT_FOUND" });
  if (found.value.version !== version) return err({ code: "CONFLICT" });

  const result = await db
    .prepare("DELETE FROM tasks WHERE id = ? AND owner_id = ? AND version = ?")
    .bind(id, owner_id, version)
    .run();

  if (changes(result) === 0) return err({ code: "CONFLICT" });
  return ok(null);
}

async function moveTasks(
  db: D1Database,
  inputs: readonly TaskOrderInput[],
): Promise<Result<Task[], RepositoryError>> {
  const current = await listTasks(db);
  if (!current.ok) return current;

  const byId = new Map(current.value.map((task) => [task.id, task]));
  const moved: Task[] = [];
  for (const input of inputs) {
    const task = byId.get(input.id);
    if (task === undefined) return err({ code: "NOT_FOUND" });
    moved.push({ ...task, order: input.order });
  }

  const results = await db.batch(
    inputs.map((input) =>
      db
        .prepare('UPDATE tasks SET "order" = ? WHERE id = ? AND owner_id = ?')
        .bind(input.order, input.id, OWNER_ID),
    ),
  );
  if (results.some((result) => changes(result) === 0)) return err({ code: "NOT_FOUND" });
  return ok(moved);
}

async function findBulkTasks(
  db: D1Database,
  inputs: readonly TaskVersionInput[],
): Promise<Result<Task[], RepositoryError>> {
  const placeholders = inputs.map(() => "?").join(", ");
  const result = await db
    .prepare(
      `SELECT ${TASK_COLUMNS} FROM tasks WHERE owner_id = ? AND id IN (${placeholders})`,
    )
    .bind(OWNER_ID, ...inputs.map((input) => input.id))
    .all<Record<string, unknown>>();
  const found = result.results.map(toTask).filter((task): task is Task => task !== undefined);
  const byId = new Map(found.map((task) => [task.id, task]));
  const validated = validateBulkTasks(inputs, (id) => byId.get(id));
  return validated.ok ? validated : err(validated.error);
}

async function executeBulk(
  db: D1Database,
  tasks: readonly Task[],
  prepare: (task: Task) => D1PreparedStatement,
): Promise<Result<null, RepositoryError>> {
  const results = await db.batch(tasks.map(prepare));
  if (results.some((result) => changes(result) === 0)) return err({ code: "CONFLICT" });
  return ok(null);
}
