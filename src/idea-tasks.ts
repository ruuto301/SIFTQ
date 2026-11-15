import { nextIdeaOrder } from "./idea";
import type { Idea } from "./idea";
import { createTask, nextTaskOrder, ok } from "./task";
import type { DomainError, Result, Task } from "./task";

const OWNER_ID = "local";

/** Builds a new idea for the local user, ordering it within the same pinned group. */
export function createIdea(
  existing: readonly Idea[],
  input: { title: string; description: string; pinned: boolean },
): Idea {
  return {
    id: crypto.randomUUID(),
    owner_id: OWNER_ID,
    title: input.title,
    description: input.description,
    order: nextIdeaOrder(existing, input.pinned),
    pinned: input.pinned,
  };
}

/** Converts an idea into the ordered task to insert; validation errors keep their code. */
export function moveIdeaToTask(idea: Idea, tasks: readonly Task[]): Result<Task, DomainError> {
  const now = new Date().toISOString();
  const created = createTask({
    id: crypto.randomUUID(),
    owner_id: OWNER_ID,
    title: idea.title,
    description: idea.description,
    status: "do",
    created_at: now,
    updated_at: now,
  });
  if (!created.ok) return created;
  return ok({ ...created.value, order: nextTaskOrder(tasks) });
}
