import type { IdeaRepository } from "./repository/idea-repository";
import type { ImageRepository } from "./repository/image-repository";
import type { TaskRepository } from "./repository/task-repository";

const IMAGE_TOKEN = /\/api\/images\/[0-9A-Za-z_-]+/g;

/** Image tokens (paths) contained in a description, in order. */
export function descriptionImageTokens(description: string): string[] {
  return description.match(IMAGE_TOKEN) ?? [];
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function isReferenced(token: string, tasks: readonly { description: string }[], notes: readonly { title: string; body: string }[]): boolean {
  return (
    tasks.some((task) => task.description.includes(token)) ||
    notes.some((note) => note.body.includes(token) || note.title.includes(token))
  );
}

export type CleanupDeps = {
  tasks: TaskRepository;
  ideas: IdeaRepository;
  images: ImageRepository;
};

/**
 * Deletes images that disappeared from a description and are no longer referenced
 * by any task or idea. Best effort: repository failures leave the image in place.
 */
export async function cleanupRemovedImages(
  previous: string,
  next: string,
  deps: CleanupDeps,
): Promise<string[]> {
  const removed = unique(descriptionImageTokens(previous).filter((token) => !next.includes(token)));
  if (removed.length === 0) return [];
  const tasks = await deps.tasks.list();
  const ideas = await deps.ideas.list("local");
  if (!tasks.ok || !ideas.ok) return [];
  const deleted: string[] = [];
  for (const token of removed) {
    if (isReferenced(token, tasks.value, ideas.value)) continue;
    const id = token.slice("/api/images/".length);
    const result = await deps.images.delete(id, "local");
    if (result.ok && result.value) deleted.push(id);
  }
  return deleted;
}
