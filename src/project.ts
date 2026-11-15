import { err, ok } from "./result";
import type { Result } from "./result";

const PROJECT_ID_MAX_LENGTH = 64;

const PROJECT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

const PROJECT_NAME_MAX_CODE_POINTS = 32;


export type Project = {
  id: string;
  name: string;
  sort_order: number;
};

export type ProjectInputError = {
  code: "INVALID_PROJECT_ID" | "INVALID_PROJECT_NAME";
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
  const length = Array.from(name.trim()).length;
  return length >= 1 && length <= PROJECT_NAME_MAX_CODE_POINTS;
}

/** Project names are unique regardless of case; `exceptId` lets a project keep its own name. */
export function hasProjectName(
  projects: readonly Project[],
  name: string,
  exceptId?: string,
): boolean {
  const normalized = name.trim().toLowerCase();
  return projects.some(
    (project) => project.id !== exceptId && project.name.trim().toLowerCase() === normalized,
  );
}

export function toProject(value: unknown): Project | undefined {
  if (!isProjectRecord(value)) return undefined;

  const { id, name, sort_order } = value;
  if (!isProjectId(id)) return undefined;
  if (typeof name !== "string" || !isProjectNameValid(name)) return undefined;
  if (typeof sort_order !== "number") return undefined;

  return { id, name: name.trim(), sort_order };
}

export function sortProjects(projects: readonly Project[]): Project[] {
  return [...projects].sort(
    (left, right) => left.sort_order - right.sort_order || left.id.localeCompare(right.id),
  );
}

export function nextProjectOrder(projects: readonly Project[]): number {
  return projects.reduce((maximum, project) => Math.max(maximum, project.sort_order), 0) + 1;
}

function readProjectName(value: unknown): Result<string, ProjectInputError> {
  if (typeof value !== "string") return err({ code: "INVALID_PROJECT_NAME" });
  const trimmedName = value.trim();
  if (!isProjectNameValid(trimmedName)) return err({ code: "INVALID_PROJECT_NAME" });
  return ok(trimmedName);
}

export type ProjectCreateInput = {
  id: string;
  name: string;
};

export function parseProjectCreate(body: Record<string, unknown>): Result<ProjectCreateInput, ProjectInputError> {
  const id = body["id"];
  if (!isProjectId(id)) return err({ code: "INVALID_PROJECT_ID" });

  const name = readProjectName(body["name"]);
  if (!name.ok) return name;

  return ok({ id, name: name.value });
}

export type ProjectPatch = {
  name?: string;
};

export function parseProjectPatch(body: Record<string, unknown>): Result<ProjectPatch, ProjectInputError> {
  const patch: ProjectPatch = {};

  if ("name" in body) {
    const name = readProjectName(body["name"]);
    if (!name.ok) return name;
    patch.name = name.value;
  }

  return ok(patch);
}

export function applyProjectPatch(project: Project, patch: ProjectPatch): Project {
  return { ...project, ...patch };
}
