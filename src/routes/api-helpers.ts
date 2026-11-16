import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { Result } from "../task";

type SharedEnv = { Bindings: Record<string, unknown> };

export function problem<T extends SharedEnv>(c: Context<T>, status: ContentfulStatusCode, code: string) {
  return c.json({ code }, status);
}

export async function readJsonRecord<T extends SharedEnv>(
  c: Context<T>,
  isValid: (value: unknown) => value is Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  try {
    const value = await c.req.json<unknown>();
    return isValid(value) ? value : null;
  } catch {
    return null;
  }
}

export type OwnedLookup<T, E> = { ok: true; value: T } | { ok: false; error: E };

export async function findOwned<T, E>(
  result: Promise<Result<T | undefined, E>>,
  notFound: E,
): Promise<OwnedLookup<T, E>> {
  const loaded = await result;
  if (!loaded.ok) return loaded;
  return loaded.value === undefined ? { ok: false, error: notFound } : { ok: true, value: loaded.value };
}

export async function respondRemoved<T extends SharedEnv, E extends { code: string }>(
  c: Context<T>,
  removed: Promise<Result<null, E>>,
) {
  const result = await removed;
  if (!result.ok) return problem(c, errorStatus(result.error.code), result.error.code);
  return c.body(null, 204);
}

export function errorStatus(code: string): ContentfulStatusCode {
  if (code === "NOT_FOUND") return 404;
  if (code === "ATTACHMENT_TOO_LARGE") return 413;
  if (code === "ATTACHMENTS_UNAVAILABLE") return 503;
  if (code === "CONFLICT" || code === "INVALID_STATE") return 409;
  return 400;
}

/** Renders a list result, mapping repository failures to 500. */
export function respondList<T extends SharedEnv, V, E extends { code: string }>(c: Context<T>, result: Result<readonly V[], E>) {
  return result.ok ? c.json(result.value) : problem(c, 500, result.error.code);
}

/** Renders an update result, mapping repository failures through the caller's status rule. */
export function respondUpdated<T extends SharedEnv, V, E extends { code: string }>(
  c: Context<T>,
  result: Result<V, E>,
  statusOf: (code: string) => ContentfulStatusCode,
) {
  return result.ok ? c.json(result.value) : problem(c, statusOf(result.error.code), result.error.code);
}
