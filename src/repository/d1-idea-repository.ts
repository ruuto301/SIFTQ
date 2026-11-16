import type { D1Database } from "@cloudflare/workers-types";
import {
  IDEA_DEFAULT_SORT,
  changeIdeaNoteColor,
  changeIdeaNotePinned,
  isDeleted,
  isIdeaColor,
  isIdeaImage,
  ideaSortParts,
  setNoteArchived,
  setNoteDeleted,
} from "../idea";
import type {
  IdeaColor,
  IdeaImage,
  IdeaNote,
  IdeaNoteCounts,
  IdeaNoteQuery,
  IdeaPreviewFields,
  IdeaSort,
} from "../idea";
import { err, ok } from "../task";
import { isRecord } from "../task";
import type { Result } from "../task";
import type { IdeaRepository, IdeaRepositoryError } from "./idea-repository";
import { changes, runMutation } from "./d1-changes";

const IDEA_COLUMNS =
  "id, owner_id, title, body, color, pinned, created_at, updated_at, archived_at, deleted_at, preview_title, preview_description, preview_image, preview_domain, preview_fetched_at";
const IDEA_SELECT = `SELECT ${IDEA_COLUMNS} FROM ideas`;
const IDEA_IMAGE_COLUMNS = "id, note_id, owner_id, image_id, position, created_at";
const IDEA_IMAGE_SELECT = `SELECT ${IDEA_IMAGE_COLUMNS} FROM idea_images`;
const IDEA_IMAGE_LIMIT = 50;
const IDEA_BULK_LIMIT = 50;

const NULLABLE_NOTE_COLUMNS = [
  "archived_at",
  "deleted_at",
  "preview_title",
  "preview_description",
  "preview_image",
  "preview_domain",
  "preview_fetched_at",
] as const;

type NullableNoteColumns = { archived_at: string | null; deleted_at: string | null } & IdeaPreviewFields;

function isNullableText(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function hasNullableNoteColumns(value: Record<string, unknown>): value is Record<string, unknown> & NullableNoteColumns {
  return NULLABLE_NOTE_COLUMNS.every((column) => isNullableText(value[column]));
}

export function toIdeaNote(value: unknown): IdeaNote | undefined {
  if (!isRecord(value)) return undefined;
  const { id, owner_id, title, body, color, pinned, created_at, updated_at } = value;
  if (
    typeof id !== "string" ||
    typeof owner_id !== "string" ||
    typeof title !== "string" ||
    typeof body !== "string" ||
    !isIdeaColor(color) ||
    (pinned !== 0 && pinned !== 1) ||
    typeof created_at !== "string" ||
    typeof updated_at !== "string"
  ) {
    return undefined;
  }
  if (!hasNullableNoteColumns(value)) return undefined;
  const {
    archived_at,
    deleted_at,
    preview_title,
    preview_description,
    preview_image,
    preview_domain,
    preview_fetched_at,
  } = value;
  return {
    id,
    owner_id,
    title,
    body,
    color,
    pinned: pinned === 1,
    created_at,
    updated_at,
    archived_at,
    deleted_at,
    preview_title,
    preview_description,
    preview_image,
    preview_domain,
    preview_fetched_at,
  };
}


export function toIdeaImage(value: unknown): IdeaImage | undefined {
  return isIdeaImage(value) ? value : undefined;
}



function readCount(row: Record<string, unknown> | null, key: string): number {
  const value = row?.[key];
  return typeof value === "number" ? value : 0;
}

function toIdeaNoteCounts(row: Record<string, unknown> | null): IdeaNoteCounts {
  return {
    notes: readCount(row, "notes"),
    pinned: readCount(row, "pinned"),
    unpinned: readCount(row, "unpinned"),
    archived: readCount(row, "archived"),
    trash: readCount(row, "trash"),
  };
}


/** Deletes/mutates one row and reports NOT_FOUND when nothing changed. */
function runMutationNotFound(
  db: D1Database,
  sql: string,
  args: readonly unknown[],
): Promise<Result<null, IdeaRepositoryError>> {
  return runMutation(db, sql, args, { code: "NOT_FOUND" });
}

export function createD1IdeaRepository(db: D1Database): IdeaRepository {
  return {
    list: (owner_id, query) => listNotes(db, owner_id, query),
    counts: (owner_id) => countNotes(db, owner_id),
    find: (id, owner_id) => findNote(db, id, owner_id),
    insert: (note) => insertNote(db, note),
    update: (note) => updateNote(db, note),
    remove: (id, owner_id) => removeNotes(db, [id], owner_id, false).then((result) => (result.ok ? ok(null) : result)),
    bulkUpdateColor: (ids, owner_id, color) => bulkUpdateColor(db, ids, owner_id, color),
    bulkPin: (ids, owner_id, pinned) => bulkPin(db, ids, owner_id, pinned),
    bulkRemove: (ids, owner_id) => removeNotes(db, ids, owner_id, false),
    bulkArchive: (ids, owner_id, archived) => bulkArchive(db, ids, owner_id, archived),
    bulkTrash: (ids, owner_id, deleted) => bulkTrash(db, ids, owner_id, deleted),
    purge: (ids, owner_id) => removeNotes(db, ids, owner_id, true),
    listImages: (note_id, owner_id) => listImages(db, note_id, owner_id),
    insertImage: (link) => insertImage(db, link),
    removeImage: (id, owner_id) => runMutationNotFound(db, "DELETE FROM idea_images WHERE id = ? AND owner_id = ?", [id, owner_id]),
    countImages: (note_id, owner_id) => countImages(db, note_id, owner_id),
  };
}

type SqlQuery = { sql: string; bindings: unknown[] };

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, "\\$&");
}

function viewClauses(filter: IdeaNoteQuery["filter"]): string[] {
  if (filter === "trash") return ["deleted_at IS NOT NULL"];
  if (filter === "archived") return ["deleted_at IS NULL", "archived_at IS NOT NULL"];
  const clauses = ["deleted_at IS NULL", "archived_at IS NULL"];
  if (filter === "pinned") clauses.push("pinned = 1");
  if (filter === "unpinned") clauses.push("pinned = 0");
  return clauses;
}

function pushDateClauses(query: IdeaNoteQuery, clauses: string[], bindings: unknown[]): void {
  if (query.dateKind === undefined) return;
  const column = query.dateKind === "created" ? "created_at" : "updated_at";
  if (query.from !== undefined) {
    clauses.push(`${column} >= ?`);
    bindings.push(query.from);
  }
  if (query.to !== undefined) {
    clauses.push(`${column} <= ?`);
    bindings.push(query.to);
  }
}

function filterClauses(owner_id: string, query: IdeaNoteQuery): SqlQuery {
  const clauses = ["owner_id = ?", ...viewClauses(query.filter ?? "notes")];
  const bindings: unknown[] = [owner_id];
  if (query.color !== undefined) {
    clauses.push("color = ?");
    bindings.push(query.color);
  }
  const text = query.text?.trim() ?? "";
  if (text !== "") {
    const pattern = `%${escapeLike(text)}%`;
    clauses.push("(title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\')");
    bindings.push(pattern, pattern);
  }
  pushDateClauses(query, clauses, bindings);
  return { sql: `WHERE ${clauses.join(" AND ")}`, bindings };
}

function sortOrder(sort: IdeaSort | undefined): string {
  const parts = ideaSortParts(sort ?? IDEA_DEFAULT_SORT);
  const column = parts.field === "created" ? "created_at" : "updated_at";
  return `${column} ${parts.direction === "asc" ? "ASC" : "DESC"}`;
}

async function listNotes(
  db: D1Database,
  owner_id: string,
  query: IdeaNoteQuery | undefined,
): Promise<Result<IdeaNote[], IdeaRepositoryError>> {
  const filter = filterClauses(owner_id, query ?? {});
  const result = await db
    .prepare(`${IDEA_SELECT} ${filter.sql} ORDER BY pinned DESC, ${sortOrder(query?.sort)}, id ASC LIMIT 200`)
    .bind(...filter.bindings)
    .all<Record<string, unknown>>();
  return ok(result.results.map(toIdeaNote).filter((note): note is IdeaNote => note !== undefined));
}

async function countNotes(db: D1Database, owner_id: string): Promise<Result<IdeaNoteCounts, IdeaRepositoryError>> {
  const row = await db
    .prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN deleted_at IS NULL AND archived_at IS NULL THEN 1 ELSE 0 END), 0) AS notes,
        COALESCE(SUM(CASE WHEN deleted_at IS NULL AND archived_at IS NULL AND pinned = 1 THEN 1 ELSE 0 END), 0) AS pinned,
        COALESCE(SUM(CASE WHEN deleted_at IS NULL AND archived_at IS NULL AND pinned = 0 THEN 1 ELSE 0 END), 0) AS unpinned,
        COALESCE(SUM(CASE WHEN deleted_at IS NULL AND archived_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS archived,
        COALESCE(SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS trash
      FROM ideas WHERE owner_id = ?`,
    )
    .bind(owner_id)
    .first<Record<string, unknown>>();
  return ok(toIdeaNoteCounts(row));
}

async function findNote(
  db: D1Database,
  id: string,
  owner_id: string,
): Promise<Result<IdeaNote | undefined, IdeaRepositoryError>> {
  const row = await db
    .prepare(`${IDEA_SELECT} WHERE id = ? AND owner_id = ?`)
    .bind(id, owner_id)
    .first<Record<string, unknown>>();
  return ok(row === null ? undefined : toIdeaNote(row));
}

function noteContentValues(note: IdeaNote): readonly unknown[] {
  return [note.title, note.body, note.color, note.pinned ? 1 : 0];
}

/** The writable columns in `IDEA_COLUMNS` order, excluding the fixed `created_at`. */
function mutableNoteValues(note: IdeaNote): readonly unknown[] {
  return [...noteContentValues(note), note.updated_at, ...noteStateValues(note)];
}

function noteStateValues(note: IdeaNote): readonly unknown[] {
  return [
    note.archived_at,
    note.deleted_at,
    note.preview_title,
    note.preview_description,
    note.preview_image,
    note.preview_domain,
    note.preview_fetched_at,
  ];
}

async function insertNote(db: D1Database, note: IdeaNote): Promise<Result<IdeaNote, IdeaRepositoryError>> {
  await db
    .prepare(`INSERT INTO ideas (${IDEA_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(note.id, note.owner_id, ...noteContentValues(note), note.created_at, note.updated_at, ...noteStateValues(note))
    .run();
  return ok(note);
}

async function updateNote(db: D1Database, note: IdeaNote): Promise<Result<IdeaNote, IdeaRepositoryError>> {
  const result = await db
    .prepare(
      "UPDATE ideas SET title = ?, body = ?, color = ?, pinned = ?, updated_at = ?, archived_at = ?, deleted_at = ?, preview_title = ?, preview_description = ?, preview_image = ?, preview_domain = ?, preview_fetched_at = ? WHERE id = ? AND owner_id = ?",
    )
    .bind(...mutableNoteValues(note), note.id, note.owner_id)
    .run();
  return changes(result) === 0 ? err({ code: "NOT_FOUND" }) : ok(note);
}

/** Loads the requested notes for one owner, or NOT_FOUND when any id is unknown. */
async function findNotes(
  db: D1Database,
  ids: readonly string[],
  owner_id: string,
): Promise<Result<IdeaNote[], IdeaRepositoryError>> {
  const placeholders = ids.map(() => "?").join(", ");
  const result = await db
    .prepare(`${IDEA_SELECT} WHERE owner_id = ? AND id IN (${placeholders}) LIMIT ${IDEA_BULK_LIMIT}`)
    .bind(owner_id, ...ids)
    .all<Record<string, unknown>>();
  const found = result.results.map(toIdeaNote).filter((note): note is IdeaNote => note !== undefined);
  return found.length === ids.length ? ok(found) : err({ code: "NOT_FOUND" });
}

type BulkValue = string | number | null;
type BulkChange = (notes: readonly IdeaNote[], updated_at: string) => IdeaNote[];

async function runBulkChange(
  db: D1Database,
  ids: readonly string[],
  owner_id: string,
  sql: string,
  value: (updated_at: string) => BulkValue,
  change: BulkChange,
): Promise<Result<IdeaNote[], IdeaRepositoryError>> {
  const current = await findNotes(db, ids, owner_id);
  if (!current.ok) return current;
  const updated_at = new Date().toISOString();
  const bound = value(updated_at);
  const results = await db.batch(ids.map((id) => db.prepare(sql).bind(bound, updated_at, id, owner_id)));
  if (results.some((result) => changes(result) === 0)) return err({ code: "NOT_FOUND" });
  return ok(change(current.value, updated_at));
}

async function bulkUpdateColor(
  db: D1Database,
  ids: readonly string[],
  owner_id: string,
  color: IdeaColor,
): Promise<Result<IdeaNote[], IdeaRepositoryError>> {
  return runBulkChange(
    db,
    ids,
    owner_id,
    "UPDATE ideas SET color = ?, updated_at = ? WHERE id = ? AND owner_id = ?",
    () => color,
    (notes, updated_at) => notes.map((note) => changeIdeaNoteColor(note, color, updated_at)),
  );
}

async function bulkPin(
  db: D1Database,
  ids: readonly string[],
  owner_id: string,
  pinned: boolean,
): Promise<Result<IdeaNote[], IdeaRepositoryError>> {
  return runBulkChange(
    db,
    ids,
    owner_id,
    "UPDATE ideas SET pinned = ?, updated_at = ? WHERE id = ? AND owner_id = ?",
    () => (pinned ? 1 : 0),
    (notes, updated_at) => notes.map((note) => changeIdeaNotePinned(note, pinned, updated_at)),
  );
}

async function bulkArchive(
  db: D1Database,
  ids: readonly string[],
  owner_id: string,
  archived: boolean,
): Promise<Result<IdeaNote[], IdeaRepositoryError>> {
  return runBulkChange(
    db,
    ids,
    owner_id,
    "UPDATE ideas SET archived_at = ?, updated_at = ? WHERE id = ? AND owner_id = ?",
    (updated_at) => (archived ? updated_at : null),
    (notes, updated_at) => notes.map((note) => setNoteArchived(note, archived, updated_at)),
  );
}

async function bulkTrash(
  db: D1Database,
  ids: readonly string[],
  owner_id: string,
  deleted: boolean,
): Promise<Result<IdeaNote[], IdeaRepositoryError>> {
  return runBulkChange(
    db,
    ids,
    owner_id,
    "UPDATE ideas SET deleted_at = ?, updated_at = ? WHERE id = ? AND owner_id = ?",
    (updated_at) => (deleted ? updated_at : null),
    (notes, updated_at) => notes.map((note) => setNoteDeleted(note, deleted, updated_at)),
  );
}

/** Permanent removal; `requireTrashed` keeps purge scoped to the trash view. */
async function removeNotes(
  db: D1Database,
  ids: readonly string[],
  owner_id: string,
  requireTrashed: boolean,
): Promise<Result<null, IdeaRepositoryError>> {
  const current = await findNotes(db, ids, owner_id);
  if (!current.ok) return current;
  if (requireTrashed && current.value.some((note) => !isDeleted(note))) return err({ code: "INVALID_STATE" });
  await db.batch(ids.map((id) => db.prepare("DELETE FROM idea_images WHERE note_id = ? AND owner_id = ?").bind(id, owner_id)));
  const removed = await db.batch(ids.map((id) => db.prepare("DELETE FROM ideas WHERE id = ? AND owner_id = ?").bind(id, owner_id)));
  return removed.some((result) => changes(result) === 0) ? err({ code: "NOT_FOUND" }) : ok(null);
}

async function listImages(
  db: D1Database,
  note_id: string,
  owner_id: string,
): Promise<Result<IdeaImage[], IdeaRepositoryError>> {
  const result = await db
    .prepare(`${IDEA_IMAGE_SELECT} WHERE note_id = ? AND owner_id = ? ORDER BY position ASC, id ASC LIMIT ${IDEA_IMAGE_LIMIT}`)
    .bind(note_id, owner_id)
    .all<Record<string, unknown>>();
  return ok(result.results.map(toIdeaImage).filter((link): link is IdeaImage => link !== undefined));
}

async function insertImage(db: D1Database, link: IdeaImage): Promise<Result<IdeaImage, IdeaRepositoryError>> {
  await db
    .prepare(`INSERT INTO idea_images (${IDEA_IMAGE_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(link.id, link.note_id, link.owner_id, link.image_id, link.position, link.created_at)
    .run();
  return ok(link);
}

async function countImages(
  db: D1Database,
  note_id: string,
  owner_id: string,
): Promise<Result<number, IdeaRepositoryError>> {
  const row = await db
    .prepare("SELECT COUNT(*) AS total FROM idea_images WHERE note_id = ? AND owner_id = ?")
    .bind(note_id, owner_id)
    .first<{ total: number }>();
  return ok(row === null ? 0 : row.total);
}









