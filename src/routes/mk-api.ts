import type { Context, Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { applyMkNotePatch, createMkNote, isMkBodyValid, isMkColor, isMkFilter, isMkRecord, isMkTitleValid, parseMkNotePatch } from "../mk";
import type { MkError, MkNote, MkNoteQuery } from "../mk";
import type { AppEnv } from "../app-env";
import type { MkRepository } from "../repository/mk-repository";
import { err, ok } from "../task";
import type { Result } from "../task";

const OWNER_ID = "local";
const MK_BULK_MAX_ITEMS = 50;

type Repository = (c: Context<AppEnv>) => MkRepository;

function problem(c: Context<AppEnv>, status: ContentfulStatusCode, code: string) {
  return c.json({ code }, status);
}

async function readJsonRecord(c: Context<AppEnv>): Promise<Record<string, unknown> | null> {
  try {
    const value = await c.req.json<unknown>();
    return isMkRecord(value) ? value : null;
  } catch {
    return null;
  }
}

function errorStatus(code: string): ContentfulStatusCode {
  return code === "NOT_FOUND" ? 404 : 400;
}

function readQuery(c: Context<AppEnv>): Result<MkNoteQuery, MkError> {
  const query: MkNoteQuery = {};
  const filter = c.req.query("filter");
  if (filter !== undefined && filter !== "" && filter !== "all") {
    if (!isMkFilter(filter)) return err({ code: "INVALID_FILTER" });
    query.filter = filter;
  }
  const color = c.req.query("color");
  if (color !== undefined && color !== "" && color !== "all") {
    if (!isMkColor(color)) return err({ code: "INVALID_COLOR" });
    query.color = color;
  }
  const text = c.req.query("q")?.trim() ?? "";
  if (text !== "") query.text = text;
  return ok(query);
}

type MkLookup = { ok: true; value: MkNote } | { ok: false; error: MkError };

async function findMkNote(c: Context<AppEnv>, repository: Repository, id: string): Promise<MkLookup> {
  const result = await repository(c).find(id, OWNER_ID);
  if (!result.ok) return result;
  return result.value === undefined ? { ok: false, error: { code: "NOT_FOUND" } } : { ok: true, value: result.value };
}

async function listMkNotes(c: Context<AppEnv>, repository: Repository) {
  const query = readQuery(c);
  if (!query.ok) return problem(c, 400, query.error.code);
  const result = await repository(c).list(OWNER_ID, query.value);
  if (!result.ok) return problem(c, 500, result.error.code);
  return c.json(result.value);
}

async function createMkNoteAtBoundary(c: Context<AppEnv>, repository: Repository) {
  const body = await readJsonRecord(c);
  if (body === null) return problem(c, 400, "INVALID_INPUT");
  const title = typeof body["title"] === "string" ? body["title"].trim() : "";
  const noteBody = typeof body["body"] === "string" ? body["body"] : "";
  if (!isMkTitleValid(title)) return problem(c, 400, "INVALID_TITLE");
  if (!isMkBodyValid(noteBody)) return problem(c, 400, "INVALID_BODY");
  const color = body["color"];
  if (color !== undefined && !isMkColor(color)) return problem(c, 400, "INVALID_COLOR");
  const pinned = body["pinned"];
  if (pinned !== undefined && typeof pinned !== "boolean") return problem(c, 400, "INVALID_PINNED");
  const created = createMkNote({
    id: crypto.randomUUID(),
    owner_id: OWNER_ID,
    title,
    body: noteBody,
    ...(color === undefined ? {} : { color }),
    ...(pinned === undefined ? {} : { pinned }),
    created_at: new Date().toISOString(),
  });
  if (!created.ok) return problem(c, 400, created.error.code);
  const inserted = await repository(c).insert(created.value);
  if (!inserted.ok) return problem(c, 500, inserted.error.code);
  return c.json(inserted.value, 201);
}

async function patchMkNote(c: Context<AppEnv>, repository: Repository) {
  const body = await readJsonRecord(c);
  if (body === null) return problem(c, 400, "INVALID_INPUT");
  const id = c.req.param("id");
  if (id === undefined) return problem(c, 404, "NOT_FOUND");
  const found = await findMkNote(c, repository, id);
  if (!found.ok) return problem(c, errorStatus(found.error.code), found.error.code);
  const patch = parseMkNotePatch(body);
  if (!patch.ok) return problem(c, errorStatus(patch.error.code), patch.error.code);
  const updated = await repository(c).update(applyMkNotePatch(found.value, patch.value, new Date().toISOString()));
  if (!updated.ok) return problem(c, errorStatus(updated.error.code), updated.error.code);
  return c.json(updated.value);
}

async function deleteMkNote(c: Context<AppEnv>, repository: Repository) {
  const id = c.req.param("id");
  if (id === undefined) return problem(c, 404, "NOT_FOUND");
  const removed = await repository(c).remove(id, OWNER_ID);
  if (!removed.ok) return problem(c, errorStatus(removed.error.code), removed.error.code);
  return c.body(null, 204);
}

function readBulkIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MK_BULK_MAX_ITEMS) return null;
  const ids = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string" || item === "") return null;
    ids.add(item);
  }
  return ids.size === value.length ? [...ids] : null;
}

async function bulkColor(c: Context<AppEnv>, repository: Repository, ids: readonly string[], value: unknown) {
  if (!isMkColor(value)) return problem(c, 400, "INVALID_COLOR");
  const updated = await repository(c).bulkUpdateColor(ids, OWNER_ID, value);
  if (!updated.ok) return problem(c, errorStatus(updated.error.code), updated.error.code);
  return c.json(updated.value);
}

async function bulkPin(c: Context<AppEnv>, repository: Repository, ids: readonly string[], value: unknown) {
  if (typeof value !== "boolean") return problem(c, 400, "INVALID_PINNED");
  const updated = await repository(c).bulkPin(ids, OWNER_ID, value);
  if (!updated.ok) return problem(c, errorStatus(updated.error.code), updated.error.code);
  return c.json(updated.value);
}

async function bulkMkNotes(c: Context<AppEnv>, repository: Repository) {
  const body = await readJsonRecord(c);
  if (body === null) return problem(c, 400, "INVALID_BULK_INPUT");
  const ids = readBulkIds(body["ids"]);
  if (ids === null) return problem(c, 400, "INVALID_BULK_INPUT");
  const action = body["action"];
  if (action === "color") return bulkColor(c, repository, ids, body["color"]);
  if (action === "pin") return bulkPin(c, repository, ids, body["pinned"]);
  if (action !== "delete") return problem(c, 400, "INVALID_INPUT");
  const removed = await repository(c).bulkRemove(ids, OWNER_ID);
  if (!removed.ok) return problem(c, errorStatus(removed.error.code), removed.error.code);
  return c.body(null, 204);
}

export function registerMkApiRoutes(app: Hono<AppEnv>, repository: Repository) {
  app.get("/api/mk/notes", (c) => listMkNotes(c, repository));
  app.post("/api/mk/notes", (c) => createMkNoteAtBoundary(c, repository));
  app.post("/api/mk/notes/bulk", (c) => bulkMkNotes(c, repository));
  app.patch("/api/mk/notes/:id", (c) => patchMkNote(c, repository));
  app.delete("/api/mk/notes/:id", (c) => deleteMkNote(c, repository));
}
