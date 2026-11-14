import type { D1Database, D1Result } from "@cloudflare/workers-types";
import { changeMkNoteColor, changeMkNotePinned, isMkColor } from "../mk";
import type { MkColor, MkNote, MkNoteQuery } from "../mk";
import { err, ok } from "../task";
import type { Result } from "../task";
import type { MkRepository, MkRepositoryError } from "./mk-repository";

const MK_COLUMNS = "id, owner_id, title, body, color, pinned, created_at, updated_at";
const MK_SELECT = `SELECT ${MK_COLUMNS} FROM mk_notes`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

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

export function createD1MkRepository(db: D1Database): MkRepository {
  return {
    list: (owner_id, query) => listNotes(db, owner_id, query),
    find: (id, owner_id) => findNote(db, id, owner_id),
    insert: (note) => insertNote(db, note),
    update: (note) => updateNote(db, note),
    remove: (id, owner_id) => removeNote(db, id, owner_id),
    bulkUpdateColor: (ids, owner_id, color) => bulkUpdateColor(db, ids, owner_id, color),
    bulkPin: (ids, owner_id, pinned) => bulkPin(db, ids, owner_id, pinned),
    bulkRemove: (ids, owner_id) => bulkRemove(db, ids, owner_id),
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

async function removeNote(
  db: D1Database,
  id: string,
  owner_id: string,
): Promise<Result<null, MkRepositoryError>> {
  const result = await db.prepare("DELETE FROM mk_notes WHERE id = ? AND owner_id = ?").bind(id, owner_id).run();
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
