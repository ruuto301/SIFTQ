import type { Context, Hono } from "hono";
import {
  applyMkNotePatch,
  applyMkNotePreview,
  createMkNote,
  isMkBodyValid,
  isMkColor,
  isMkDateKind,
  isMkFilter,
  isMkRecord,
  isMkTitleValid,
  normalizeMkDateBound,
  parseMkIdList,
  parseMkNotePatch,
  parseMkSort,
} from "../mk";
import type { MkColor, MkDateKind, MkError, MkFilter, MkNote, MkNoteQuery, MkSort } from "../mk";
import { extractMkPreviewUrl, fetchMkLinkPreview } from "../mk-link-preview";
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

/** A null result means "present but invalid"; undefined means "absent". */
function readFilterValue(value: string | undefined): MkFilter | null | undefined {
  if (value === undefined || value === "") return undefined;
  const normalized = normalizeFilter(value);
  if (normalized === null) return null;
  return normalized === "notes" ? undefined : normalized;
}

function readColorValue(value: string | undefined): MkColor | null | undefined {
  if (value === undefined || value === "" || value === "all") return undefined;
  return isMkColor(value) ? value : null;
}

function readSortValue(value: string | undefined): MkSort | null | undefined {
  if (value === undefined || value === "") return undefined;
  return parseMkSort(value);
}

function readQuery(c: Context<AppEnv>): Result<MkNoteQuery, MkError> {
  const core = readCoreQuery(c);
  if (!core.ok) return core;
  const extra = readExtraQuery(c);
  if (!extra.ok) return extra;
  return ok({ ...core.value, ...extra.value });
}

function readCoreQuery(c: Context<AppEnv>): Result<MkNoteQuery, MkError> {
  const query: MkNoteQuery = {};
  const filter = readFilterValue(c.req.query("filter"));
  if (filter === null) return err({ code: "INVALID_FILTER" });
  if (filter !== undefined) query.filter = filter;
  const color = readColorValue(c.req.query("color"));
  if (color === null) return err({ code: "INVALID_COLOR" });
  if (color !== undefined) query.color = color;
  const text = c.req.query("q")?.trim() ?? "";
  if (text !== "") query.text = text;
  return ok(query);
}

function readExtraQuery(c: Context<AppEnv>): Result<MkNoteQuery, MkError> {
  const query: MkNoteQuery = {};
  const sort = readSortValue(c.req.query("sort"));
  if (sort === null) return err({ code: "INVALID_SORT" });
  if (sort !== undefined) query.sort = sort;
  const dates = readDateQuery(c);
  if (!dates.ok) return dates;
  if (dates.value.dateKind !== undefined) query.dateKind = dates.value.dateKind;
  if (dates.value.from !== undefined) query.from = dates.value.from;
  if (dates.value.to !== undefined) query.to = dates.value.to;
  return ok(query);
}

type MkDateQuery = { dateKind?: MkDateKind; from?: string; to?: string };

/** Accepts an exact ISO instant or a date-only field; the API rejects anything else. */
function readDateBound(c: Context<AppEnv>, name: string, dateName: string, endOfDay: boolean): Result<string | undefined, MkError> {
  const value = c.req.query(name) || c.req.query(dateName) || "";
  if (value === "") return ok(undefined);
  const bound = normalizeMkDateBound(value, endOfDay);
  return bound === null ? err({ code: "INVALID_DATE" }) : ok(bound);
}

function readDateQuery(c: Context<AppEnv>): Result<MkDateQuery, MkError> {
  const raw = c.req.query("dateKind");
  const dateKind = raw === undefined || raw === "" ? undefined : raw;
  if (dateKind !== undefined && !isMkDateKind(dateKind)) return err({ code: "INVALID_DATE" });
  const from = readDateBound(c, "from", "fromDate", false);
  if (!from.ok) return from;
  const to = readDateBound(c, "to", "toDate", true);
  if (!to.ok) return to;
  const dates: MkDateQuery = {};
  if (from.value !== undefined) dates.from = from.value;
  if (to.value !== undefined) dates.to = to.value;
  if (dates.from === undefined && dates.to === undefined) return ok(dates);
  return ok({ ...dates, dateKind: dateKind ?? "created" });
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

/** Fetches the first link in the note and stores its metadata; failures store nothing. */
async function previewMkNote(c: Context<AppEnv>, repository: Repository) {
  const id = c.req.param("id");
  if (id === undefined) return problem(c, 404, "NOT_FOUND");
  const found = await findMkNote(c, repository, id);
  if (!found.ok) return problem(c, errorStatus(found.error.code), found.error.code);
  const url = extractMkPreviewUrl(`${found.value.title}\n${found.value.body}`);
  if (url === null) return problem(c, 400, "INVALID_URL");
  const preview = await fetchMkLinkPreview(url);
  if (!preview.ok) return problem(c, preview.error === "INVALID_URL" ? 400 : 502, preview.error);
  const updated = await repository(c).update(applyMkNotePreview(found.value, preview.value, new Date().toISOString()));
  if (!updated.ok) return problem(c, errorStatus(updated.error.code), updated.error.code);
  return c.json(updated.value);
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

export function registerMkApiRoutes(app: Hono<AppEnv>, repository: Repository) {
  app.get("/api/mk/notes", (c) => listMkNotes(c, repository));
  app.post("/api/mk/notes", (c) => createMkNoteAtBoundary(c, repository));
  app.post("/api/mk/notes/bulk", (c) => bulkMkNotes(c, repository));
  app.post("/api/mk/notes/:id/preview", (c) => previewMkNote(c, repository));
  app.patch("/api/mk/notes/:id", (c) => patchMkNote(c, repository));
  app.delete("/api/mk/notes/:id", (c) => deleteMkNote(c, repository));
}
