import { isProjectId } from "./project";

export const TASK_STATUSES = ["do", "done", "skip"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_TITLE_MAX_CODE_POINTS = 256;
export const TASK_DESCRIPTION_MAX_CODE_POINTS = 16_384;

export type Task = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  working: boolean;
  project: string | null;
  order: number;
  version: number;
  created_at: string;
  updated_at: string;
};

export type DomainErrorCode =
  | "INVALID_TITLE"
  | "INVALID_DESCRIPTION"
  | "INVALID_STATUS"
  | "INVALID_PROJECT"
  | "INVALID_WORKING"
  | "INVALID_ORDER"
  | "INVALID_BULK_INPUT"
  | "NOT_FOUND"
  | "CONFLICT";

export type DomainError = { code: DomainErrorCode };

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T, E>(value: T): Result<T, E> {
  return { ok: true, value };
}

export function err<T, E>(error: E): Result<T, E> {
  return { ok: false, error };
}

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === "string" && TASK_STATUSES.some((status) => status === value);
}

export function isTaskProject(value: unknown): value is string | null {
  return value === null || isProjectId(value);
}

export function isTaskOrderValid(order: number): boolean {
  return Number.isSafeInteger(order) && order > 0;
}

export type TaskVersionInput = {
  id: string;
  version: number;
};

export const TASK_BULK_MAX_ITEMS = 50;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseTaskVersionInputs(value: unknown): Result<TaskVersionInput[], DomainError> {
  if (!Array.isArray(value) || value.length === 0 || value.length > TASK_BULK_MAX_ITEMS) {
    return err({ code: "INVALID_BULK_INPUT" });
  }

  const ids = new Set<string>();
  const inputs: TaskVersionInput[] = [];
  for (const item of value) {
    if (!isRecord(item)) return err({ code: "INVALID_BULK_INPUT" });
    const id = item["id"];
    const version = item["version"];
    if (
      typeof id !== "string" ||
      id.length === 0 ||
      ids.has(id) ||
      typeof version !== "number" ||
      !Number.isSafeInteger(version) ||
      version < 1
    ) {
      return err({ code: "INVALID_BULK_INPUT" });
    }
    ids.add(id);
    inputs.push({ id, version });
  }
  return ok(inputs);
}

function changeTasks(
  tasks: readonly Task[],
  change: (task: Task) => Result<Task, DomainError>,
  updatedAt?: string,
): Result<Task[], DomainError> {
  const updated: Task[] = [];
  for (const task of tasks) {
    const changed = change(task);
    if (!changed.ok) return err(changed.error);
    const next = { ...changed.value, version: task.version + 1 };
    updated.push(updatedAt === undefined ? next : { ...next, updated_at: updatedAt });
  }
  return ok(updated);
}

export function changeTaskStatuses(
  tasks: readonly Task[],
  status: TaskStatus,
  updatedAt?: string,
): Result<Task[], DomainError> {
  return changeTasks(tasks, (task) => changeTaskStatus(task, status), updatedAt);
}

export function changeTaskProjects(
  tasks: readonly Task[],
  project: string | null,
  updatedAt?: string,
): Result<Task[], DomainError> {
  return changeTasks(tasks, (task) => changeTaskProject(task, project), updatedAt);
}

export function is_working(task: Task): boolean {
  return task.working;
}

export function titleCodePointLength(title: string): number {
  return Array.from(title).length;
}

export function isTaskTitleValid(title: string): boolean {
  const length = titleCodePointLength(title);
  return length >= 1 && length <= TASK_TITLE_MAX_CODE_POINTS;
}

export function descriptionCodePointLength(description: string): number {
  return Array.from(description).length;
}

export function isTaskDescriptionValid(description: string): boolean {
  return descriptionCodePointLength(description) <= TASK_DESCRIPTION_MAX_CODE_POINTS;
}

export type CreateTaskInput = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  status?: TaskStatus;
  project?: string | null;
  created_at: string;
  updated_at: string;
};

export function createTask(input: CreateTaskInput): Result<Task, DomainError> {
  if (!isTaskTitleValid(input.title)) {
    return err({ code: "INVALID_TITLE" });
  }
  if (!isTaskDescriptionValid(input.description)) {
    return err({ code: "INVALID_DESCRIPTION" });
  }

  return ok({
    id: input.id,
    owner_id: input.owner_id,
    title: input.title,
    description: input.description,
    status: input.status ?? "do",
    working: false,
    project: input.project ?? null,
    order: 1,
    version: 1,
    created_at: input.created_at,
    updated_at: input.updated_at,
  });
}

export function changeTaskStatus(task: Task, status: TaskStatus): Result<Task, DomainError> {
  return ok({ ...task, status });
}

export function changeTaskProject(task: Task, project: string | null): Result<Task, DomainError> {
  return ok({ ...task, project });
}

export function changeTaskWorking(task: Task, working: boolean): Result<Task, DomainError> {
  return ok({ ...task, working });
}

export type TaskPatch = {
  title?: string;
  description?: string;
  status?: TaskStatus;
  project?: string | null;
  working?: boolean;
};

export function parseTaskPatch(body: Record<string, unknown>): Result<TaskPatch, DomainError> {
  const patch: TaskPatch = {};

  if (typeof body["title"] === "string") {
    const title = body["title"].trim();
    if (!isTaskTitleValid(title)) return err({ code: "INVALID_TITLE" });
    patch.title = title;
  }
  if (typeof body["description"] === "string") {
    if (!isTaskDescriptionValid(body["description"])) return err({ code: "INVALID_DESCRIPTION" });
    patch.description = body["description"];
  }
  if ("status" in body) {
    if (!isTaskStatus(body["status"])) return err({ code: "INVALID_STATUS" });
    patch.status = body["status"];
  }
  if ("project" in body) {
    if (!isTaskProject(body["project"])) return err({ code: "INVALID_PROJECT" });
    patch.project = body["project"];
  }
  if ("working" in body) {
    if (typeof body["working"] !== "boolean") return err({ code: "INVALID_WORKING" });
    patch.working = body["working"];
  }

  return ok(patch);
}

export function applyTaskPatch(task: Task, patch: TaskPatch): Task {
  return { ...task, ...patch };
}

export function nextTaskOrder(tasks: readonly Task[]): number {
  return tasks.reduce((maximum, task) => Math.max(maximum, task.order), 0) + 1;
}
