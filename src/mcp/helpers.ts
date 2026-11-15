import { readOptionalNumber, readString } from "./schema";
import { errorContent, jsonContent, repositoryError, type ToolResult } from "./types";

/** Structural view of the repository results the MCP tools consume. */
export type RepoResult<T> = { ok: true; value: T } | { ok: false; error: { code: string } };

/** Validated `{id, version}` pair used by the versioned task tools. */
export type VersionedInput = { id: string; version: number };

/** Distinguishes a loaded domain value from a tool error result. */
export function isToolResult(value: unknown): value is ToolResult {
  return typeof value === "object" && value !== null && "content" in value;
}

/** Reads the required non-empty `id` argument. */
export function readId(args: Record<string, unknown>): string | ToolResult {
  const id = readString(args, "id");
  if (id === null || id === "") return errorContent("INVALID_INPUT", "id is required");
  return id;
}

/** Reads the `{id, version}` pair required by the versioned task tools. */
export function readVersionedInput(args: Record<string, unknown>): VersionedInput | ToolResult {
  const id = readString(args, "id");
  const version = readOptionalNumber(args, "version");
  if (id === null || id === "" || version === null || version <= 0) {
    return errorContent("INVALID_INPUT", "id and version are required");
  }
  return { id, version };
}

async function findOne<T>(message: string, pending: Promise<RepoResult<T | undefined>>): Promise<T | ToolResult> {
  const found = await pending;
  if (!found.ok) return errorContent(found.error.code, message);
  if (found.value === undefined) return repositoryError("NOT_FOUND");
  return found.value;
}

/** Reads the `id` argument, loads the entity, and maps a failed or missing lookup to a tool error. */
export async function findById<T>(
  args: Record<string, unknown>,
  message: string,
  find: (id: string) => Promise<RepoResult<T | undefined>>,
): Promise<T | ToolResult> {
  const id = readId(args);
  if (isToolResult(id)) return id;
  return findOne(message, find(id));
}

/** Like {@link findById} for versioned task tools, keeping the validated input for the mutation. */
export async function findVersioned<T>(
  args: Record<string, unknown>,
  message: string,
  find: (input: VersionedInput) => Promise<RepoResult<T | undefined>>,
): Promise<{ input: VersionedInput; value: T } | ToolResult> {
  const input = readVersionedInput(args);
  if (isToolResult(input)) return input;
  const value = await findOne(message, find(input));
  if (isToolResult(value)) return value;
  return { input, value };
}

/** Awaits an update and turns its result into tool content. */
export async function updateContent<T>(pending: Promise<RepoResult<T>>): Promise<ToolResult> {
  const updated = await pending;
  if (!updated.ok) return repositoryError(updated.error.code);
  return jsonContent(updated.value);
}

/** Awaits a delete and turns its result into the `{deleted}` tool content. */
export async function removeContent(id: string, pending: Promise<RepoResult<unknown>>): Promise<ToolResult> {
  const removed = await pending;
  if (!removed.ok) return repositoryError(removed.error.code);
  return jsonContent({ deleted: id });
}
