import { isProjectId } from "./project";
import { isTaskDescriptionValid, isTaskTitleValid } from "./task";

export type ParsedBody = Record<string, unknown>;

export function parseVersion(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) return null;
  return value;
}

export function parseTaskVersion(value: unknown): number | null {
  if (typeof value !== "string" || value === "") return null;
  const version = Number(value);
  if (!Number.isInteger(version) || version < 1) return null;
  return version;
}

/** Parses a project select value. Returns null for 未分類 and undefined for an invalid value. */
export function parseTaskProject(value: unknown): string | null | undefined {
  if (typeof value !== "string") return undefined;
  const candidate = value.trim();
  if (candidate === "" || candidate === "none") return null;
  return isProjectId(candidate) ? candidate : undefined;
}

export function readTaskFields(body: ParsedBody): {
  title: string;
  description: string;
} {
  const title = typeof body["title"] === "string" ? body["title"].trim() : "";
  const description = typeof body["description"] === "string" ? body["description"] : "";
  return { title, description };
}

export function isInvalidTaskTitle(title: string): boolean {
  return !isTaskTitleValid(title);
}

export function isInvalidTaskDescription(description: string): boolean {
  return !isTaskDescriptionValid(description);
}
