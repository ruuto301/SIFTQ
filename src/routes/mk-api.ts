import type { Context, Hono } from "hono";
import {
  applyMkNotePatch,
  createMkLabel,
  createMkNote,
  isMkBodyValid,
  isMkColor,
  isMkFilter,
  isMkLabelNameValid,
  isMkRecord,
  isMkTitleValid,
  normalizeMkLabelName,
  parseMkIdList,
  parseMkLabelIds,
  parseMkNotePatch,
} from "../mk";
import type { MkError, MkFilter, MkNote, MkNoteQuery } from "../mk";
import { errorStatus, findOwned, problem, readJsonRecord, respondRemoved } from "./api-helpers";
import type { AppEnv } from "../app-env";
import type { MkRepository } from "../repository/mk-repository";
import { err, ok } from "../task";
import type { Result } from "../task";

const OWNER_ID = "local";
const MK_BULK_MAX_ITEMS = 50;

type Repository = (c: Context<AppEnv>) => MkRepository;

function normalizeFilter(value: string): MkFilter | null {
  const candidate = value === "all" ? "notes" : value;
  return isMkFilter(candidate) ? candidate : null;
}

function readQuery(c: Context<AppEnv>): Result<MkNoteQuery, MkError> {
  const query: MkNoteQuery = {};
  const filter = c.req.query("filter");
  if (filter !== undefined && filter !== "") {
    const normalized = normalizeFilter(filter);
    if (normalized === null) return err({ code: "INVALID_FILTER" });
    if (normalized !== "notes") query.filter = normalized;
  }
  const color = c.req.query("color");
  if (color !== undefined && color !== "" && color !== "all") {
    if (!isMkColor(color)) return err({ code: "INVALID_COLOR" });
    query.color = color;
  }
  const label = c.req.query("label");
  if (label !== undefined && label !== "") query.labelId = label;
  const text = c.req.query("q")?.trim() ?? "";
  if (text !== "") query.text = text;
  return ok(query);
}

type MkLookup = { ok: true; value: MkNote } | { ok: false; error: MkError };

/** Reads the JSON body and the path id shared by the note and label detail routes. */
async function readMkTarget(c: Context<AppEnv>): Promise<Result<{ body: Record<string, unknown>; id: string }, MkError>> {
  const body = await readJsonRecord(c, isMkRecord);
  if (body === null) return err({ code: "INVALID_INPUT" });
  const id = c.req.param("id");
  if (id === undefined) return err({ code: "NOT_FOUND" });
  return ok({ body, id });
}

async function findMkNote(c: Context<AppEnv>, repository: Repository, id: string): Promise<MkLookup> {
  return findOwned(repository(c).find(id, OWNER_ID), { code: "NOT_FOUND" });
}

async function listMkNotes(c: Context<AppEnv>, repository: Repository) {
  const query = readQuery(c);
  if (!query.ok) return problem(c, 400, query.error.code);
  const result = await repository(c).list(OWNER_ID, query.value);
  if (!result.ok) return problem(c, 500, result.error.code);
  return c.json(result.value);
}

async function createMkNoteAtBoundary(c: Context<AppEnv>, repository: Repository) {
  const body = await readJsonRecord(c, isMkRecord);
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
  const target = await readMkTarget(c);
  if (!target.ok) return problem(c, errorStatus(target.error.code), target.error.code);
  const found = await findMkNote(c, repository, target.value.id);
  if (!found.ok) return problem(c, errorStatus(found.error.code), found.error.code);
  const patch = parseMkNotePatch(target.value.body);
  if (!patch.ok) return problem(c, errorStatus(patch.error.code), patch.error.code);
  const updated = await repository(c).update(applyMkNotePatch(found.value, patch.value, new Date().toISOString()));
  if (!updated.ok) return problem(c, errorStatus(updated.error.code), updated.error.code);
  return c.json(updated.value);
}

async function deleteMkNote(c: Context<AppEnv>, repository: Repository) {
  const id = c.req.param("id");
  if (id === undefined) return problem(c, 404, "NOT_FOUND");
  return respondRemoved(c, repository(c).remove(id, OWNER_ID));
}

function readBulkIds(value: unknown): string[] | null {
  const ids = parseMkIdList(value, MK_BULK_MAX_ITEMS);
  return ids === null || ids.length === 0 ? null : ids;
}

async function respondBulk(c: Context<AppEnv>, result: ReturnType<MkRepository["bulkUpdateColor"]>) {
  const updated = await result;
  if (!updated.ok) return problem(c, errorStatus(updated.error.code), updated.error.code);
  return c.json(updated.value);
}

async function bulkColor(c: Context<AppEnv>, repository: Repository, ids: readonly string[], value: unknown) {
  if (!isMkColor(value)) return problem(c, 400, "INVALID_COLOR");
  return respondBulk(c, repository(c).bulkUpdateColor(ids, OWNER_ID, value));
}

async function bulkPin(c: Context<AppEnv>, repository: Repository, ids: readonly string[], value: unknown) {
  if (typeof value !== "boolean") return problem(c, 400, "INVALID_PINNED");
  return respondBulk(c, repository(c).bulkPin(ids, OWNER_ID, value));
}

async function bulkMkNotes(c: Context<AppEnv>, repository: Repository) {
  const body = await readJsonRecord(c, isMkRecord);
  if (body === null) return problem(c, 400, "INVALID_BULK_INPUT");
  const ids = readBulkIds(body["ids"]);
  if (ids === null) return problem(c, 400, "INVALID_BULK_INPUT");
  const action = body["action"];
  if (action === "color") return bulkColor(c, repository, ids, body["color"]);
  if (action === "pin") return bulkPin(c, repository, ids, body["pinned"]);
  if (action === "archive" || action === "unarchive") {
    return respondBulk(c, repository(c).bulkArchive(ids, OWNER_ID, action === "archive"));
  }
  if (action === "trash" || action === "restore") {
    return respondBulk(c, repository(c).bulkTrash(ids, OWNER_ID, action === "trash"));
  }
  if (action === "purge") return respondRemoved(c, repository(c).purge(ids, OWNER_ID));
  if (action !== "delete") return problem(c, 400, "INVALID_INPUT");
  return respondRemoved(c, repository(c).bulkRemove(ids, OWNER_ID));
}

function readLabelName(body: Record<string, unknown>): Result<string, MkError> {
  const raw = typeof body["name"] === "string" ? body["name"] : "";
  const name = normalizeMkLabelName(raw);
  return isMkLabelNameValid(name) ? ok(name) : err({ code: "INVALID_LABEL_NAME" });
}

async function listMkLabels(c: Context<AppEnv>, repository: Repository) {
  const result = await repository(c).listLabels(OWNER_ID);
  if (!result.ok) return problem(c, 500, result.error.code);
  return c.json(result.value);
}

async function createMkLabelAtBoundary(c: Context<AppEnv>, repository: Repository) {
  const body = await readJsonRecord(c, isMkRecord);
  if (body === null) return problem(c, 400, "INVALID_INPUT");
  const name = readLabelName(body);
  if (!name.ok) return problem(c, 400, name.error.code);
  const created = createMkLabel({
    id: crypto.randomUUID(),
    owner_id: OWNER_ID,
    name: name.value,
    created_at: new Date().toISOString(),
  });
  if (!created.ok) return problem(c, 400, created.error.code);
  const inserted = await repository(c).createLabel(created.value);
  if (!inserted.ok) return problem(c, errorStatus(inserted.error.code), inserted.error.code);
  return c.json(inserted.value, 201);
}

async function renameMkLabel(c: Context<AppEnv>, repository: Repository) {
  const target = await readMkTarget(c);
  if (!target.ok) return problem(c, errorStatus(target.error.code), target.error.code);
  const name = readLabelName(target.value.body);
  if (!name.ok) return problem(c, 400, name.error.code);
  const renamed = await repository(c).renameLabel(target.value.id, OWNER_ID, name.value);
  if (!renamed.ok) return problem(c, errorStatus(renamed.error.code), renamed.error.code);
  return c.json(renamed.value);
}

async function deleteMkLabel(c: Context<AppEnv>, repository: Repository) {
  const id = c.req.param("id");
  if (id === undefined) return problem(c, 404, "NOT_FOUND");
  return respondRemoved(c, repository(c).deleteLabel(id, OWNER_ID));
}

async function setMkNoteLabels(c: Context<AppEnv>, repository: Repository) {
  const target = await readMkTarget(c);
  if (!target.ok) return problem(c, errorStatus(target.error.code), target.error.code);
  const labelIds = parseMkLabelIds(target.value.body["labelIds"]);
  if (labelIds === null) return problem(c, 400, "INVALID_LABEL");
  const attached = await repository(c).setNoteLabels(target.value.id, OWNER_ID, labelIds);
  if (!attached.ok) return problem(c, errorStatus(attached.error.code), attached.error.code);
  return c.json(attached.value);
}

export function registerMkApiRoutes(app: Hono<AppEnv>, repository: Repository) {
  app.get("/api/mk/notes", (c) => listMkNotes(c, repository));
  app.post("/api/mk/notes", (c) => createMkNoteAtBoundary(c, repository));
  app.post("/api/mk/notes/bulk", (c) => bulkMkNotes(c, repository));
  app.post("/api/mk/notes/:id/labels", (c) => setMkNoteLabels(c, repository));
  app.get("/api/mk/labels", (c) => listMkLabels(c, repository));
  app.post("/api/mk/labels", (c) => createMkLabelAtBoundary(c, repository));
  app.patch("/api/mk/labels/:id", (c) => renameMkLabel(c, repository));
  app.delete("/api/mk/labels/:id", (c) => deleteMkLabel(c, repository));
  app.patch("/api/mk/notes/:id", (c) => patchMkNote(c, repository));
  app.delete("/api/mk/notes/:id", (c) => deleteMkNote(c, repository));
}
