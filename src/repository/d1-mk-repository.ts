import type { D1Database, D1Result } from "@cloudflare/workers-types";
import { changeMkNoteColor, changeMkNotePinned, isMkColor, isMkImage } from "../mk";
import type { MkColor, MkImage, MkNote, MkNoteQuery } from "../mk";
import { err, ok } from "../task";
import { isRecord } from "../task";
import type { Result } from "../task";
import type { MkRepository, MkRepositoryError } from "./mk-repository";

const MK_COLUMNS = "id, owner_id, title, body, color, pinned, created_at, updated_at";
const MK_SELECT = `SELECT ${MK_COLUMNS} FROM mk_notes`;
const MK_IMAGE_COLUMNS = "id, note_id, owner_id, image_id, position, created_at";
const MK_IMAGE_SELECT = `SELECT ${MK_IMAGE_COLUMNS} FROM mk_images`;
const MK_IMAGE_LIMIT = 50;

export function toMkNote(value: unknown): MkNote | undefined {
  if (!isRecord(value)) return undefined;
  const { id, owner_id, title, body, color, pinned, created_at, updated_at } = value;
  if (
    typeof id !== "string" ||
    typeof owner_id !== "string" ||
    typeof title !== "string" ||
    typeof body !== "string" ||
    !isMkColor(color) ||
    (pinned !== 0 && pinned !== 1) ||
    typeof created_at !== "string" ||
    typeof updated_at !== "string"
  ) {
    return undefined;
  }
  return { id, owner_id, title, body, color, pinned: pinned === 1, created_at, updated_at };
}

function changes(result: D1Result): number {
  return result.meta?.changes ?? 0;
}

export function toMkImage(value: unknown): MkImage | undefined {
  return isMkImage(value) ? value : undefined;
}

export function createD1MkRepository(db: D1Database): MkRepository {
  return {
    list: (owner_id, query) => listNotes(db, owner_id, query),
    find: (id, owner_id) => findNote(db, id, owner_id),
    insert: (note) => insertNote(db, note),
    update: (note) => updateNote(db, note),
    remove: (id, owner_id) => deleteRow(db, "DELETE FROM mk_notes WHERE id = ? AND owner_id = ?", [id, owner_id]),
    bulkUpdateColor: (ids, owner_id, color) => bulkUpdateColor(db, ids, owner_id, color),
    bulkPin: (ids, owner_id, pinned) => bulkPin(db, ids, owner_id, pinned),
    bulkRemove: (ids, owner_id) => bulkRemove(db, ids, owner_id),
    listImages: (note_id, owner_id) => listImages(db, note_id, owner_id),
    insertImage: (link) => insertImage(db, link),
    removeImage: (id, owner_id) => deleteRow(db, "DELETE FROM mk_images WHERE id = ? AND owner_id = ?", [id, owner_id]),
    countImages: (note_id, owner_id) => countImages(db, note_id, owner_id),
  };
}

type SqlQuery = { sql: string; bindings: unknown[] };

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, "\\$&");
}

function filterClauses(owner_id: string, query: MkNoteQuery): SqlQuery {
  const clauses = ["owner_id = ?"];
  const bindings: unknown[] = [owner_id];
  if (query.filter === "pinned") clauses.push("pinned = 1");
  if (query.filter === "unpinned") clauses.push("pinned = 0");
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
  return { sql: `WHERE ${clauses.join(" AND ")}`, bindings };
}

async function listNotes(
  db: D1Database,
  owner_id: string,
  query: MkNoteQuery | undefined,
): Promise<Result<MkNote[], MkRepositoryError>> {
  const filter = filterClauses(owner_id, query ?? {});
  const result = await db
    .prepare(`${MK_SELECT} ${filter.sql} ORDER BY pinned DESC, updated_at DESC, id ASC LIMIT 200`)
    .bind(...filter.bindings)
    .all<Record<string, unknown>>();
  return ok(result.results.map(toMkNote).filter((note): note is MkNote => note !== undefined));
}

async function findNote(
  db: D1Database,
  id: string,
  owner_id: string,
): Promise<Result<MkNote | undefined, MkRepositoryError>> {
  const row = await db
    .prepare(`${MK_SELECT} WHERE id = ? AND owner_id = ?`)
    .bind(id, owner_id)
    .first<Record<string, unknown>>();
  return ok(row === null ? undefined : toMkNote(row));
}

async function insertNote(db: D1Database, note: MkNote): Promise<Result<MkNote, MkRepositoryError>> {
  await db
    .prepare(`INSERT INTO mk_notes (${MK_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      note.id,
      note.owner_id,
      note.title,
      note.body,
      note.color,
      note.pinned ? 1 : 0,
      note.created_at,
      note.updated_at,
    )
    .run();
  return ok(note);
}

async function updateNote(db: D1Database, note: MkNote): Promise<Result<MkNote, MkRepositoryError>> {
  const result = await db
    .prepare("UPDATE mk_notes SET title = ?, body = ?, color = ?, pinned = ?, updated_at = ? WHERE id = ? AND owner_id = ?")
    .bind(note.title, note.body, note.color, note.pinned ? 1 : 0, note.updated_at, note.id, note.owner_id)
    .run();
  return changes(result) === 0 ? err({ code: "NOT_FOUND" }) : ok(note);
}

async function deleteRow(
  db: D1Database,
  sql: string,
  args: readonly unknown[],
): Promise<Result<null, MkRepositoryError>> {
  const result = await db.prepare(sql).bind(...args).run();
  return changes(result) === 0 ? err({ code: "NOT_FOUND" }) : ok(null);
}

/** Loads the requested notes for one owner, or NOT_FOUND when any id is unknown. */
async function findNotes(
  db: D1Database,
  ids: readonly string[],
  owner_id: string,
): Promise<Result<MkNote[], MkRepositoryError>> {
  const placeholders = ids.map(() => "?").join(", ");
  const result = await db
    .prepare(`${MK_SELECT} WHERE owner_id = ? AND id IN (${placeholders}) LIMIT 50`)
    .bind(owner_id, ...ids)
    .all<Record<string, unknown>>();
  const found = result.results.map(toMkNote).filter((note): note is MkNote => note !== undefined);
  return found.length === ids.length ? ok(found) : err({ code: "NOT_FOUND" });
}

type BulkChange = (notes: readonly MkNote[], updated_at: string) => MkNote[];

async function runBulkChange(
  db: D1Database,
  ids: readonly string[],
  owner_id: string,
  sql: string,
  value: string | number,
  change: BulkChange,
): Promise<Result<MkNote[], MkRepositoryError>> {
  const current = await findNotes(db, ids, owner_id);
  if (!current.ok) return current;
  const updated_at = new Date().toISOString();
  const results = await db.batch(ids.map((id) => db.prepare(sql).bind(value, updated_at, id, owner_id)));
  if (results.some((result) => changes(result) === 0)) return err({ code: "NOT_FOUND" });
  return ok(change(current.value, updated_at));
}

async function bulkUpdateColor(
  db: D1Database,
  ids: readonly string[],
  owner_id: string,
  color: MkColor,
): Promise<Result<MkNote[], MkRepositoryError>> {
  return runBulkChange(
    db,
    ids,
    owner_id,
    "UPDATE mk_notes SET color = ?, updated_at = ? WHERE id = ? AND owner_id = ?",
    color,
    (notes, updated_at) => notes.map((note) => changeMkNoteColor(note, color, updated_at)),
  );
}

async function bulkPin(
  db: D1Database,
  ids: readonly string[],
  owner_id: string,
  pinned: boolean,
): Promise<Result<MkNote[], MkRepositoryError>> {
  return runBulkChange(
    db,
    ids,
    owner_id,
    "UPDATE mk_notes SET pinned = ?, updated_at = ? WHERE id = ? AND owner_id = ?",
    pinned ? 1 : 0,
    (notes, updated_at) => notes.map((note) => changeMkNotePinned(note, pinned, updated_at)),
  );
}

async function bulkRemove(
  db: D1Database,
  ids: readonly string[],
  owner_id: string,
): Promise<Result<null, MkRepositoryError>> {
  const results = await db.batch(
    ids.map((id) => db.prepare("DELETE FROM mk_notes WHERE id = ? AND owner_id = ?").bind(id, owner_id)),
  );
  if (results.some((result) => changes(result) === 0)) return err({ code: "NOT_FOUND" });
  return ok(null);
}

async function listImages(
  db: D1Database,
  note_id: string,
  owner_id: string,
): Promise<Result<MkImage[], MkRepositoryError>> {
  const result = await db
    .prepare(`${MK_IMAGE_SELECT} WHERE note_id = ? AND owner_id = ? ORDER BY position ASC, id ASC LIMIT ${MK_IMAGE_LIMIT}`)
    .bind(note_id, owner_id)
    .all<Record<string, unknown>>();
  return ok(result.results.map(toMkImage).filter((link): link is MkImage => link !== undefined));
}

async function insertImage(db: D1Database, link: MkImage): Promise<Result<MkImage, MkRepositoryError>> {
  await db
    .prepare(`INSERT INTO mk_images (${MK_IMAGE_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(link.id, link.note_id, link.owner_id, link.image_id, link.position, link.created_at)
    .run();
  return ok(link);
}

async function countImages(
  db: D1Database,
  note_id: string,
  owner_id: string,
): Promise<Result<number, MkRepositoryError>> {
  const row = await db
    .prepare("SELECT COUNT(*) AS total FROM mk_images WHERE note_id = ? AND owner_id = ?")
    .bind(note_id, owner_id)
    .first<{ total: number }>();
  return ok(row === null ? 0 : row.total);
}
