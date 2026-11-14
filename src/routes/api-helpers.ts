import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppEnv } from "../app-env";
import type { Result } from "../task";

export function problem(c: Context<AppEnv>, status: ContentfulStatusCode, code: string) {
  return c.json({ code }, status);
}

export async function readJsonRecord(
  c: Context<AppEnv>,
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

export function errorStatus(code: string): ContentfulStatusCode {
  if (code === "NOT_FOUND") return 404;
  if (code === "CONFLICT") return 409;
  return 400;
}
