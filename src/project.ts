import { err, ok } from "./result";
import type { Result } from "./result";

const PROJECT_ID_MAX_LENGTH = 64;

const PROJECT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

const PROJECT_NAME_MAX_CODE_POINTS = 100;

const PROJECT_PATH_MAX_CODE_POINTS = 1024;

export type Project = {
  id: string;
  name: string;
  path: string | null;
  sort_order: number;
  archived: boolean;
};

export type ProjectInputError = {
  code: "INVALID_PROJECT_ID" | "INVALID_PROJECT_NAME" | "INVALID_PROJECT_PATH" | "INVALID_PROJECT_ARCHIVED";
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

export function isProjectNameValid(name: string): boolean {
  const length = Array.from(name).length;
  return length >= 1 && length <= PROJECT_NAME_MAX_CODE_POINTS;
}

export function isProjectPath(value: unknown): value is string | null {
  if (value === null) return true;
  return typeof value === "string" && Array.from(value.trim()).length <= PROJECT_PATH_MAX_CODE_POINTS;
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

export function nextProjectOrder(projects: readonly Project[]): number {
  return projects.reduce((maximum, project) => Math.max(maximum, project.sort_order), 0) + 1;
}

/** Stores a blank path as `null` so an empty form value cannot create a stray directory. */
function normalizeProjectPath(path: string | null): string | null {
  if (path === null || path.trim().length === 0) return null;
  return path;
}

export type ProjectCreateInput = {
  id: string;
  name: string;
  path: string | null;
  archived: boolean;
};

export function parseProjectCreate(body: Record<string, unknown>): Result<ProjectCreateInput, ProjectInputError> {
  const id = body["id"];
  if (!isProjectId(id)) return err({ code: "INVALID_PROJECT_ID" });

  const name = body["name"];
  if (typeof name !== "string") return err({ code: "INVALID_PROJECT_NAME" });
  const trimmedName = name.trim();
  if (!isProjectNameValid(trimmedName)) return err({ code: "INVALID_PROJECT_NAME" });

  const path = body["path"] ?? null;
  if (!isProjectPath(path)) return err({ code: "INVALID_PROJECT_PATH" });

  const archived = body["archived"] ?? false;
  if (typeof archived !== "boolean") return err({ code: "INVALID_PROJECT_ARCHIVED" });

  return ok({ id, name: trimmedName, path: normalizeProjectPath(path), archived });
}

export type ProjectPatch = {
  name?: string;
  path?: string | null;
  archived?: boolean;
};

export function parseProjectPatch(body: Record<string, unknown>): Result<ProjectPatch, ProjectInputError> {
  const patch: ProjectPatch = {};

  if ("name" in body) {
    const name = body["name"];
    if (typeof name !== "string") return err({ code: "INVALID_PROJECT_NAME" });
    const trimmedName = name.trim();
    if (!isProjectNameValid(trimmedName)) return err({ code: "INVALID_PROJECT_NAME" });
    patch.name = trimmedName;
  }
  if ("path" in body) {
    const path = body["path"];
    if (!isProjectPath(path)) return err({ code: "INVALID_PROJECT_PATH" });
    patch.path = normalizeProjectPath(path);
  }
  if ("archived" in body) {
    const archived = body["archived"];
    if (typeof archived !== "boolean") return err({ code: "INVALID_PROJECT_ARCHIVED" });
    patch.archived = archived;
  }

  return ok(patch);
}

export function applyProjectPatch(project: Project, patch: ProjectPatch): Project {
  return { ...project, ...patch };
}
