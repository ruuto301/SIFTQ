import { changeTaskProjects, changeTaskStatuses, err, ok } from "../task";
import type { Result, Task, TaskStatus, TaskVersionInput } from "../task";
import { validateBulkTasks } from "../repository/repository-validation";
import type { RepositoryError, TaskOrderInput, TaskRepository } from "../repository/task-repository";

function byMostRecentlyUpdated(left: Task, right: Task): number {
  return right.updated_at.localeCompare(left.updated_at) || left.id.localeCompare(right.id);
}

export function createMemoryTaskRepository(initialTasks: readonly Task[] = []): TaskRepository {
  const tasks = new Map(initialTasks.map((task) => [task.id, task]));

  async function list(): Promise<Result<Task[], RepositoryError>> {
    return ok<Task[], RepositoryError>([...tasks.values()].sort(byMostRecentlyUpdated));
  }

  async function find(id: string, _ownerId: string): Promise<Result<Task | undefined, RepositoryError>> {
    return ok<Task | undefined, RepositoryError>(tasks.get(id));
  }

  async function insert(task: Task): Promise<Result<Task, RepositoryError>> {
    tasks.set(task.id, task);
    return ok<Task, RepositoryError>(task);
  }

  async function update(task: Task): Promise<Result<Task, RepositoryError>> {
    const current = tasks.get(task.id);
    if (!current) return err<Task, RepositoryError>({ code: "NOT_FOUND" });
    if (current.version !== task.version) return err<Task, RepositoryError>({ code: "CONFLICT" });

    const updated: Task = { ...task, version: task.version + 1 };
    tasks.set(updated.id, updated);
    return ok<Task, RepositoryError>(updated);
  }

  async function bulkUpdateStatus(
    inputs: readonly TaskVersionInput[],
    status: TaskStatus,
  ): Promise<Result<Task[], RepositoryError>> {
    return applyBulk(tasks, validateBulkTasks(inputs, (id) => tasks.get(id)), (current) =>
      changeTaskStatuses(current, status),
    );
  }

  async function bulkUpdateProject(
    inputs: readonly TaskVersionInput[],
    project: string | null,
  ): Promise<Result<Task[], RepositoryError>> {
    return applyBulk(tasks, validateBulkTasks(inputs, (id) => tasks.get(id)), (current) =>
      changeTaskProjects(current, project),
    );
  }

  async function bulkRemove(inputs: readonly TaskVersionInput[]): Promise<Result<null, RepositoryError>> {
    const current = validateBulkTasks(inputs, (id) => tasks.get(id));
    if (current.ok) {
      for (const task of current.value) tasks.delete(task.id);
      return ok(null);
    }
    return err(current.error);
  }

  async function remove(id: string, _ownerId: string, version: number): Promise<Result<null, RepositoryError>> {
    const current = tasks.get(id);
    if (!current) {
      return err<null, RepositoryError>({ code: "NOT_FOUND" });
    }
    if (current.version !== version) return err<null, RepositoryError>({ code: "CONFLICT" });

    tasks.delete(id);
    return ok<null, RepositoryError>(null);
  }

  async function move(inputs: readonly TaskOrderInput[]): Promise<Result<Task[], RepositoryError>> {
    return moveTasks(tasks, inputs);
  }

  return { list, find, insert, update, remove, move, bulkUpdateStatus, bulkUpdateProject, bulkRemove };
}

function moveTasks(
  tasks: Map<string, Task>,
  inputs: readonly TaskOrderInput[],
): Result<Task[], RepositoryError> {
  const moved: Task[] = [];
  for (const input of inputs) {
    const task = tasks.get(input.id);
    if (task === undefined) return err<Task[], RepositoryError>({ code: "NOT_FOUND" });
    moved.push({ ...task, order: input.order });
  }
  for (const task of moved) tasks.set(task.id, task);
  return ok<Task[], RepositoryError>(moved);
}

function applyBulk(
  tasks: Map<string, Task>,
  current: Result<Task[], RepositoryError>,
  change: (tasks: readonly Task[]) => Result<Task[], RepositoryError>,
): Result<Task[], RepositoryError> {
  if (!current.ok) return current;
  const updated = change(current.value);
  if (updated.ok) updated.value.forEach((task) => tasks.set(task.id, task));
  return updated;
}
