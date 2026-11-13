const PROJECT_ID_MAX_LENGTH = 64;

const PROJECT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export type Project = {
  id: string;
  name: string;
  path: string | null;
  sort_order: number;
  archived: boolean;
};

export function isProjectId(value: unknown): value is string {
  return typeof value === "string" && value.length <= PROJECT_ID_MAX_LENGTH && PROJECT_ID_PATTERN.test(value);
}

export function isProjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isProjectOrderValid(order: number): boolean {
  return Number.isSafeInteger(order) && order > 0;
}

export function toProject(value: unknown): Project | undefined {
  if (!isProjectRecord(value)) return undefined;

  const { id, name, path, sort_order, archived } = value;
  if (!isProjectId(id)) return undefined;
  if (typeof name !== "string") return undefined;
  if (path !== null && typeof path !== "string") return undefined;
  if (typeof sort_order !== "number") return undefined;
  if (archived !== 0 && archived !== 1) return undefined;

  return { id, name, path, sort_order, archived: archived === 1 };
}

export function sortProjects(projects: readonly Project[]): Project[] {
  return [...projects].sort(
    (left, right) => left.sort_order - right.sort_order || left.id.localeCompare(right.id),
  );
}
