import type { Context, Hono } from "hono";
import {
  applyIdeaNotePatch,
  applyIdeaNotePreview,
  createIdeaNote,
  isIdeaBodyValid,
  isIdeaColor,
  isIdeaDateKind,
  isIdeaFilter,
  isIdeaRecord,
  isIdeaTitleValid,
  parseIdeaIdList,
  parseIdeaNotePatch,
  parseIdeaSort,
} from "../idea";
import type { IdeaColor, IdeaDateKind, IdeaError, IdeaFilter, IdeaNote, IdeaNoteQuery, IdeaSort } from "../idea";
import { extractIdeaPreviewUrl, fetchIdeaLinkPreview } from "../idea-link-preview";
import { errorStatus, findOwned, problem, readJsonRecord, respondList, respondRemoved, respondUpdated } from "./api-helpers";
import type { AppEnv } from "../app-env";
import type { IdeaRepository } from "../repository/idea-repository";
import { normalizeIdeaDateBound } from "../idea-query";
import { err, ok } from "../task";
import type { Result } from "../task";

const OWNER_ID = "local";
const IDEA_BULK_MAX_ITEMS = 50;

type Repository = (c: Context<AppEnv>) => IdeaRepository;

function normalizeFilter(value: string): IdeaFilter | null {
  const candidate = value === "all" ? "notes" : value;
  return isIdeaFilter(candidate) ? candidate : null;
}

/** A null result means "present but invalid"; undefined means "absent". */
function readFilterValue(value: string | undefined): IdeaFilter | null | undefined {
  if (value === undefined || value === "") return undefined;
  const normalized = normalizeFilter(value);
  if (normalized === null) return null;
  return normalized === "notes" ? undefined : normalized;
}

function readColorValue(value: string | undefined): IdeaColor | null | undefined {
  if (value === undefined || value === "" || value === "all") return undefined;
  return isIdeaColor(value) ? value : null;
}

function readSortValue(value: string | undefined): IdeaSort | null | undefined {
  if (value === undefined || value === "") return undefined;
  return parseIdeaSort(value);
}

function readQuery(c: Context<AppEnv>): Result<IdeaNoteQuery, IdeaError> {
  const core = readCoreQuery(c);
  if (!core.ok) return core;
  const extra = readExtraQuery(c);
  if (!extra.ok) return extra;
  return ok({ ...core.value, ...extra.value });
}

function readCoreQuery(c: Context<AppEnv>): Result<IdeaNoteQuery, IdeaError> {
  const query: IdeaNoteQuery = {};
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

function readExtraQuery(c: Context<AppEnv>): Result<IdeaNoteQuery, IdeaError> {
  const query: IdeaNoteQuery = {};
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

type IdeaDateQuery = { dateKind?: IdeaDateKind; from?: string; to?: string };

/** Accepts an exact ISO instant or a date-only field; the API rejects anything else. */
function readDateBound(c: Context<AppEnv>, name: string, dateName: string, endOfDay: boolean): Result<string | undefined, IdeaError> {
  const value = c.req.query(name) || c.req.query(dateName) || "";
  if (value === "") return ok(undefined);
  const bound = normalizeIdeaDateBound(value, endOfDay);
  return bound === null ? err({ code: "INVALID_DATE" }) : ok(bound);
}

function readDateQuery(c: Context<AppEnv>): Result<IdeaDateQuery, IdeaError> {
  const raw = c.req.query("dateKind");
  const dateKind = raw === undefined || raw === "" ? undefined : raw;
  if (dateKind !== undefined && !isIdeaDateKind(dateKind)) return err({ code: "INVALID_DATE" });
  const from = readDateBound(c, "from", "fromDate", false);
  if (!from.ok) return from;
  const to = readDateBound(c, "to", "toDate", true);
  if (!to.ok) return to;
  const dates: IdeaDateQuery = {};
  if (from.value !== undefined) dates.from = from.value;
  if (to.value !== undefined) dates.to = to.value;
  if (dates.from === undefined && dates.to === undefined) return ok(dates);
  return ok({ ...dates, dateKind: dateKind ?? "created" });
}

type IdeaLookup = { ok: true; value: IdeaNote } | { ok: false; error: IdeaError };

/** Reads the JSON body and the path id shared by the note and label detail routes. */
async function readIdeaTarget(c: Context<AppEnv>): Promise<Result<{ body: Record<string, unknown>; id: string }, IdeaError>> {
  const body = await readJsonRecord(c, isIdeaRecord);
  if (body === null) return err({ code: "INVALID_INPUT" });
  const id = c.req.param("id");
  if (id === undefined) return err({ code: "NOT_FOUND" });
  return ok({ body, id });
}

async function findIdeaNote(c: Context<AppEnv>, repository: Repository, id: string): Promise<IdeaLookup> {
  return findOwned(repository(c).find(id, OWNER_ID), { code: "NOT_FOUND" });
}

async function listIdeaNotes(c: Context<AppEnv>, repository: Repository) {
  const query = readQuery(c);
  if (!query.ok) return problem(c, 400, query.error.code);
  return respondList(c, await repository(c).list(OWNER_ID, query.value));
}

async function createIdeaNoteAtBoundary(c: Context<AppEnv>, repository: Repository) {
  const body = await readJsonRecord(c, isIdeaRecord);
  if (body === null) return problem(c, 400, "INVALID_INPUT");
  const title = typeof body["title"] === "string" ? body["title"].trim() : "";
  const noteBody = typeof body["body"] === "string" ? body["body"] : "";
  if (!isIdeaTitleValid(title)) return problem(c, 400, "INVALID_TITLE");
  if (!isIdeaBodyValid(noteBody)) return problem(c, 400, "INVALID_BODY");
  const color = body["color"];
  if (color !== undefined && !isIdeaColor(color)) return problem(c, 400, "INVALID_COLOR");
  const pinned = body["pinned"];
  if (pinned !== undefined && typeof pinned !== "boolean") return problem(c, 400, "INVALID_PINNED");
  const created = createIdeaNote({
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

async function patchIdeaNote(c: Context<AppEnv>, repository: Repository) {
  const target = await readIdeaTarget(c);
  if (!target.ok) return problem(c, errorStatus(target.error.code), target.error.code);
  const found = await findIdeaNote(c, repository, target.value.id);
  if (!found.ok) return problem(c, errorStatus(found.error.code), found.error.code);
  const patch = parseIdeaNotePatch(target.value.body);
  if (!patch.ok) return problem(c, errorStatus(patch.error.code), patch.error.code);
  return respondUpdated(c, await repository(c).update(applyIdeaNotePatch(found.value, patch.value, new Date().toISOString())), errorStatus);
}

async function deleteIdeaNote(c: Context<AppEnv>, repository: Repository) {
  const id = c.req.param("id");
  if (id === undefined) return problem(c, 404, "NOT_FOUND");
  return respondRemoved(c, repository(c).remove(id, OWNER_ID));
}

/** Fetches the first link in the note and stores its metadata; failures store nothing. */
async function previewIdeaNote(c: Context<AppEnv>, repository: Repository) {
  const id = c.req.param("id");
  if (id === undefined) return problem(c, 404, "NOT_FOUND");
  const found = await findIdeaNote(c, repository, id);
  if (!found.ok) return problem(c, errorStatus(found.error.code), found.error.code);
  const url = extractIdeaPreviewUrl(`${found.value.title}\n${found.value.body}`);
  if (url === null) return problem(c, 400, "INVALID_URL");
  const preview = await fetchIdeaLinkPreview(url);
  if (!preview.ok) return problem(c, preview.error === "INVALID_URL" ? 400 : 502, preview.error);
  return respondUpdated(c, await repository(c).update(applyIdeaNotePreview(found.value, preview.value, new Date().toISOString())), errorStatus);
}

function readBulkIds(value: unknown): string[] | null {
  const ids = parseIdeaIdList(value, IDEA_BULK_MAX_ITEMS);
  return ids === null || ids.length === 0 ? null : ids;
}

async function respondBulk(c: Context<AppEnv>, result: ReturnType<IdeaRepository["bulkUpdateColor"]>) {
  const updated = await result;
  if (!updated.ok) return problem(c, errorStatus(updated.error.code), updated.error.code);
  return c.json(updated.value);
}

async function bulkColor(c: Context<AppEnv>, repository: Repository, ids: readonly string[], value: unknown) {
  if (!isIdeaColor(value)) return problem(c, 400, "INVALID_COLOR");
  return respondBulk(c, repository(c).bulkUpdateColor(ids, OWNER_ID, value));
}

async function bulkPin(c: Context<AppEnv>, repository: Repository, ids: readonly string[], value: unknown) {
  if (typeof value !== "boolean") return problem(c, 400, "INVALID_PINNED");
  return respondBulk(c, repository(c).bulkPin(ids, OWNER_ID, value));
}

async function bulkIdeaNotes(c: Context<AppEnv>, repository: Repository) {
  const body = await readJsonRecord(c, isIdeaRecord);
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

export function registerIdeaApiRoutes(app: Hono<AppEnv>, repository: Repository) {
  app.get("/api/ideas/notes", (c) => listIdeaNotes(c, repository));
  app.post("/api/ideas/notes", (c) => createIdeaNoteAtBoundary(c, repository));
  app.post("/api/ideas/notes/bulk", (c) => bulkIdeaNotes(c, repository));
  app.post("/api/ideas/notes/:id/preview", (c) => previewIdeaNote(c, repository));
  app.patch("/api/ideas/notes/:id", (c) => patchIdeaNote(c, repository));
  app.delete("/api/ideas/notes/:id", (c) => deleteIdeaNote(c, repository));
}
