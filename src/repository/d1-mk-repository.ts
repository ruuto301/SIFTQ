import type { D1Database, D1Result } from "@cloudflare/workers-types";
import {
  MK_DEFAULT_SORT,
  changeMkNoteColor,
  changeMkNotePinned,
  isDeleted,
  isMkColor,
  isMkImage,
  isMkLabel,
  mkSortParts,
  setNoteArchived,
  setNoteDeleted,
} from "../mk";
import type {
  MkColor,
  MkCounts,
  MkImage,
  MkLabel,
  MkNote,
  MkNoteCounts,
  MkNoteLabelMap,
  MkNoteQuery,
  MkPreviewFields,
  MkSort,
} from "../mk";
import { err, ok } from "../task";
import { isRecord } from "../task";
import type { Result } from "../task";
import type { MkRepository, MkRepositoryError } from "./mk-repository";

const MK_COLUMNS =
  "id, owner_id, title, body, color, pinned, created_at, updated_at, archived_at, deleted_at, preview_title, preview_description, preview_image, preview_domain, preview_fetched_at";
const MK_SELECT = `SELECT ${MK_COLUMNS} FROM mk_notes`;
const MK_IMAGE_COLUMNS = "id, note_id, owner_id, image_id, position, created_at";
const MK_IMAGE_SELECT = `SELECT ${MK_IMAGE_COLUMNS} FROM mk_images`;
const MK_IMAGE_LIMIT = 50;
const MK_LABEL_COLUMNS = "id, owner_id, name, created_at";
const MK_LABEL_SELECT = `SELECT ${MK_LABEL_COLUMNS} FROM mk_labels`;
const MK_LABEL_LIMIT = 200;
const MK_NOTE_LABEL_LIMIT = 500;
const MK_BULK_LIMIT = 50;

const NULLABLE_NOTE_COLUMNS = [
  "archived_at",
  "deleted_at",
  "preview_title",
  "preview_description",
  "preview_image",
  "preview_domain",
  "preview_fetched_at",
] as const;

type NullableNoteColumns = { archived_at: string | null; deleted_at: string | null } & MkPreviewFields;

function isNullableText(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function hasNullableNoteColumns(value: Record<string, unknown>): value is Record<string, unknown> & NullableNoteColumns {
  return NULLABLE_NOTE_COLUMNS.every((column) => isNullableText(value[column]));
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

export function toMkLabel(value: unknown): MkLabel | undefined {
  return isMkLabel(value) ? value : undefined;
}

function changes(result: D1Result): number {
  return result.meta?.changes ?? 0;
}

export function toMkImage(value: unknown): MkImage | undefined {
  return isMkImage(value) ? value : undefined;
}

function toNoteLabelEntry(value: unknown): { note_id: string; label: MkLabel } | undefined {
  if (!isRecord(value)) return undefined;
  const note_id = value["note_id"];
  const label = toMkLabel(value);
  return typeof note_id === "string" && label !== undefined ? { note_id, label } : undefined;
}

function groupLabels(entries: readonly { note_id: string; label: MkLabel }[]): MkNoteLabelMap {
  const map: MkNoteLabelMap = {};
  for (const entry of entries) {
    const labels = map[entry.note_id] ?? [];
    labels.push(entry.label);
    map[entry.note_id] = labels;
  }
  return map;
}

function readCount(row: Record<string, unknown> | null, key: string): number {
  const value = row?.[key];
  return typeof value === "number" ? value : 0;
}

function toMkCounts(row: Record<string, unknown> | null): MkNoteCounts {
  return {
    notes: readCount(row, "notes"),
    pinned: readCount(row, "pinned"),
    unpinned: readCount(row, "unpinned"),
    archived: readCount(row, "archived"),
    trash: readCount(row, "trash"),
  };
}

function toLabelCounts(rows: readonly Record<string, unknown>[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const id = row["label_id"];
    const total = row["total"];
    if (typeof id === "string" && typeof total === "number") counts[id] = total;
  }
  return counts;
}

export function createD1MkRepository(db: D1Database): MkRepository {
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
    removeImage: (id, owner_id) => deleteRow(db, "DELETE FROM mk_images WHERE id = ? AND owner_id = ?", [id, owner_id]),
    countImages: (note_id, owner_id) => countImages(db, note_id, owner_id),
    listLabels: (owner_id) => listLabels(db, owner_id),
    createLabel: (label) => createLabel(db, label),
    renameLabel: (id, owner_id, name) => renameLabel(db, id, owner_id, name),
    deleteLabel: (id, owner_id) => deleteLabel(db, id, owner_id),
    setNoteLabels: (note_id, owner_id, label_ids) => setNoteLabels(db, { note_id, owner_id, label_ids }),
    listLabelsForNotes: (note_ids, owner_id) => listLabelsForNotes(db, note_ids, owner_id),
  };
}

type SqlQuery = { sql: string; bindings: unknown[] };

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, "\\$&");
}

function viewClauses(filter: MkNoteQuery["filter"]): string[] {
  if (filter === "trash") return ["deleted_at IS NOT NULL"];
  if (filter === "archived") return ["deleted_at IS NULL", "archived_at IS NOT NULL"];
  const clauses = ["deleted_at IS NULL", "archived_at IS NULL"];
  if (filter === "pinned") clauses.push("pinned = 1");
  if (filter === "unpinned") clauses.push("pinned = 0");
  return clauses;
}

function pushDateClauses(query: MkNoteQuery, clauses: string[], bindings: unknown[]): void {
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

function filterClauses(owner_id: string, query: MkNoteQuery): SqlQuery {
  const clauses = ["owner_id = ?", ...viewClauses(query.filter ?? "notes")];
  const bindings: unknown[] = [owner_id];
  if (query.labelId !== undefined) {
    clauses.push(
      "EXISTS (SELECT 1 FROM mk_note_labels nl WHERE nl.note_id = mk_notes.id AND nl.label_id = ? AND nl.owner_id = ?)",
    );
    bindings.push(query.labelId, owner_id);
  }
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

function sortOrder(sort: MkSort | undefined): string {
  const parts = mkSortParts(sort ?? MK_DEFAULT_SORT);
  const column = parts.field === "created" ? "created_at" : "updated_at";
  return `${column} ${parts.direction === "asc" ? "ASC" : "DESC"}`;
}

async function listNotes(
  db: D1Database,
  owner_id: string,
  query: MkNoteQuery | undefined,
): Promise<Result<MkNote[], MkRepositoryError>> {
  const filter = filterClauses(owner_id, query ?? {});
  const result = await db
    .prepare(`${MK_SELECT} ${filter.sql} ORDER BY pinned DESC, ${sortOrder(query?.sort)}, id ASC LIMIT 200`)
    .bind(...filter.bindings)
    .all<Record<string, unknown>>();
  return ok(result.results.map(toMkNote).filter((note): note is MkNote => note !== undefined));
}

async function countNotes(db: D1Database, owner_id: string): Promise<Result<MkCounts, MkRepositoryError>> {
  const row = await db
    .prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN deleted_at IS NULL AND archived_at IS NULL THEN 1 ELSE 0 END), 0) AS notes,
        COALESCE(SUM(CASE WHEN deleted_at IS NULL AND archived_at IS NULL AND pinned = 1 THEN 1 ELSE 0 END), 0) AS pinned,
        COALESCE(SUM(CASE WHEN deleted_at IS NULL AND archived_at IS NULL AND pinned = 0 THEN 1 ELSE 0 END), 0) AS unpinned,
        COALESCE(SUM(CASE WHEN deleted_at IS NULL AND archived_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS archived,
        COALESCE(SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS trash
      FROM mk_notes WHERE owner_id = ?`,
    )
    .bind(owner_id)
    .first<Record<string, unknown>>();
  const labelRows = await db
    .prepare(
      `SELECT nl.label_id AS label_id, COUNT(*) AS total
      FROM mk_note_labels nl JOIN mk_notes n ON n.id = nl.note_id
      WHERE nl.owner_id = ? AND n.owner_id = ? AND n.deleted_at IS NULL AND n.archived_at IS NULL
      GROUP BY nl.label_id ORDER BY nl.label_id ASC LIMIT ${MK_LABEL_LIMIT}`,
    )
    .bind(owner_id, owner_id)
    .all<Record<string, unknown>>();
  return ok({ ...toMkCounts(row), labels: toLabelCounts(labelRows.results) });
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

function noteContentValues(note: MkNote): readonly unknown[] {
  return [note.title, note.body, note.color, note.pinned ? 1 : 0];
}

/** The writable columns in `MK_COLUMNS` order, excluding the fixed `created_at`. */
function mutableNoteValues(note: MkNote): readonly unknown[] {
  return [...noteContentValues(note), note.updated_at, ...noteStateValues(note)];
}

function noteStateValues(note: MkNote): readonly unknown[] {
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

async function insertNote(db: D1Database, note: MkNote): Promise<Result<MkNote, MkRepositoryError>> {
  await db
    .prepare(`INSERT INTO mk_notes (${MK_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(note.id, note.owner_id, ...noteContentValues(note), note.created_at, note.updated_at, ...noteStateValues(note))
    .run();
  return ok(note);
}

async function updateNote(db: D1Database, note: MkNote): Promise<Result<MkNote, MkRepositoryError>> {
  const result = await db
    .prepare(
      "UPDATE mk_notes SET title = ?, body = ?, color = ?, pinned = ?, updated_at = ?, archived_at = ?, deleted_at = ?, preview_title = ?, preview_description = ?, preview_image = ?, preview_domain = ?, preview_fetched_at = ? WHERE id = ? AND owner_id = ?",
    )
    .bind(...mutableNoteValues(note), note.id, note.owner_id)
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
    .prepare(`${MK_SELECT} WHERE owner_id = ? AND id IN (${placeholders}) LIMIT ${MK_BULK_LIMIT}`)
    .bind(owner_id, ...ids)
    .all<Record<string, unknown>>();
  const found = result.results.map(toMkNote).filter((note): note is MkNote => note !== undefined);
  return found.length === ids.length ? ok(found) : err({ code: "NOT_FOUND" });
}

type BulkValue = string | number | null;
type BulkChange = (notes: readonly MkNote[], updated_at: string) => MkNote[];

async function runBulkChange(
  db: D1Database,
  ids: readonly string[],
  owner_id: string,
  sql: string,
  value: (updated_at: string) => BulkValue,
  change: BulkChange,
): Promise<Result<MkNote[], MkRepositoryError>> {
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
  color: MkColor,
): Promise<Result<MkNote[], MkRepositoryError>> {
  return runBulkChange(
    db,
    ids,
    owner_id,
    "UPDATE mk_notes SET color = ?, updated_at = ? WHERE id = ? AND owner_id = ?",
    () => color,
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
    () => (pinned ? 1 : 0),
    (notes, updated_at) => notes.map((note) => changeMkNotePinned(note, pinned, updated_at)),
  );
}

async function bulkArchive(
  db: D1Database,
  ids: readonly string[],
  owner_id: string,
  archived: boolean,
): Promise<Result<MkNote[], MkRepositoryError>> {
  return runBulkChange(
    db,
    ids,
    owner_id,
    "UPDATE mk_notes SET archived_at = ?, updated_at = ? WHERE id = ? AND owner_id = ?",
    (updated_at) => (archived ? updated_at : null),
    (notes, updated_at) => notes.map((note) => setNoteArchived(note, archived, updated_at)),
  );
}

async function bulkTrash(
  db: D1Database,
  ids: readonly string[],
  owner_id: string,
  deleted: boolean,
): Promise<Result<MkNote[], MkRepositoryError>> {
  return runBulkChange(
    db,
    ids,
    owner_id,
    "UPDATE mk_notes SET deleted_at = ?, updated_at = ? WHERE id = ? AND owner_id = ?",
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
): Promise<Result<null, MkRepositoryError>> {
  const current = await findNotes(db, ids, owner_id);
  if (!current.ok) return current;
  if (requireTrashed && current.value.some((note) => !isDeleted(note))) return err({ code: "INVALID_STATE" });
  await db.batch(ids.map((id) => db.prepare("DELETE FROM mk_images WHERE note_id = ? AND owner_id = ?").bind(id, owner_id)));
  await db.batch(ids.map((id) => db.prepare("DELETE FROM mk_note_labels WHERE note_id = ? AND owner_id = ?").bind(id, owner_id)));
  const removed = await db.batch(ids.map((id) => db.prepare("DELETE FROM mk_notes WHERE id = ? AND owner_id = ?").bind(id, owner_id)));
  return removed.some((result) => changes(result) === 0) ? err({ code: "NOT_FOUND" }) : ok(null);
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

async function listLabels(db: D1Database, owner_id: string): Promise<Result<MkLabel[], MkRepositoryError>> {
  const result = await db
    .prepare(`${MK_LABEL_SELECT} WHERE owner_id = ? ORDER BY name ASC, id ASC LIMIT ${MK_LABEL_LIMIT}`)
    .bind(owner_id)
    .all<Record<string, unknown>>();
  return ok(result.results.map(toMkLabel).filter((label): label is MkLabel => label !== undefined));
}

async function findLabel(db: D1Database, id: string, owner_id: string): Promise<MkLabel | undefined> {
  const row = await db
    .prepare(`${MK_LABEL_SELECT} WHERE id = ? AND owner_id = ?`)
    .bind(id, owner_id)
    .first<Record<string, unknown>>();
  return row === null ? undefined : toMkLabel(row);
}

async function findLabelByName(db: D1Database, owner_id: string, name: string): Promise<MkLabel | undefined> {
  const row = await db
    .prepare(`${MK_LABEL_SELECT} WHERE owner_id = ? AND lower(name) = lower(?) LIMIT 1`)
    .bind(owner_id, name)
    .first<Record<string, unknown>>();
  return row === null ? undefined : toMkLabel(row);
}

async function createLabel(db: D1Database, label: MkLabel): Promise<Result<MkLabel, MkRepositoryError>> {
  const existing = await findLabelByName(db, label.owner_id, label.name);
  if (existing !== undefined) return err({ code: "CONFLICT" });
  await db
    .prepare(`INSERT INTO mk_labels (${MK_LABEL_COLUMNS}) VALUES (?, ?, ?, ?)`)
    .bind(label.id, label.owner_id, label.name, label.created_at)
    .run();
  return ok(label);
}

async function renameLabel(
  db: D1Database,
  id: string,
  owner_id: string,
  name: string,
): Promise<Result<MkLabel, MkRepositoryError>> {
  const current = await findLabel(db, id, owner_id);
  if (current === undefined) return err({ code: "NOT_FOUND" });
  const conflict = await findLabelByName(db, owner_id, name);
  if (conflict !== undefined && conflict.id !== id) return err({ code: "CONFLICT" });
  const result = await db
    .prepare("UPDATE mk_labels SET name = ? WHERE id = ? AND owner_id = ?")
    .bind(name, id, owner_id)
    .run();
  return changes(result) === 0 ? err({ code: "NOT_FOUND" }) : ok({ ...current, name });
}

async function deleteLabel(db: D1Database, id: string, owner_id: string): Promise<Result<null, MkRepositoryError>> {
  const results = await db.batch([
    db.prepare("DELETE FROM mk_note_labels WHERE label_id = ? AND owner_id = ?").bind(id, owner_id),
    db.prepare("DELETE FROM mk_labels WHERE id = ? AND owner_id = ?").bind(id, owner_id),
  ]);
  const removed = results.at(1);
  return removed === undefined || changes(removed) === 0 ? err({ code: "NOT_FOUND" }) : ok(null);
}

async function findOwnedLabels(
  db: D1Database,
  ids: readonly string[],
  owner_id: string,
): Promise<Result<MkLabel[], MkRepositoryError>> {
  if (ids.length === 0) return ok([]);
  const placeholders = ids.map(() => "?").join(", ");
  const result = await db
    .prepare(`${MK_LABEL_SELECT} WHERE owner_id = ? AND id IN (${placeholders}) LIMIT ${MK_BULK_LIMIT}`)
    .bind(owner_id, ...ids)
    .all<Record<string, unknown>>();
  const found = result.results.map(toMkLabel).filter((label): label is MkLabel => label !== undefined);
  return found.length === ids.length ? ok(found) : err({ code: "NOT_FOUND" });
}

type SetNoteLabelsInput = { note_id: string; owner_id: string; label_ids: readonly string[] };

async function setNoteLabels(
  db: D1Database,
  input: SetNoteLabelsInput,
): Promise<Result<MkLabel[], MkRepositoryError>> {
  const { note_id, owner_id, label_ids } = input;
  const labels = await findOwnedLabels(db, label_ids, owner_id);
  if (!labels.ok) return labels;
  const note = await findNote(db, note_id, owner_id);
  if (!note.ok) return note;
  if (note.value === undefined) return err({ code: "NOT_FOUND" });
  const statements = [db.prepare("DELETE FROM mk_note_labels WHERE note_id = ? AND owner_id = ?").bind(note_id, owner_id)];
  for (const label of labels.value) {
    statements.push(
      db.prepare("INSERT INTO mk_note_labels (note_id, label_id, owner_id) VALUES (?, ?, ?)").bind(note_id, label.id, owner_id),
    );
  }
  await db.batch(statements);
  return ok(labels.value);
}

async function listLabelsForNotes(
  db: D1Database,
  note_ids: readonly string[],
  owner_id: string,
): Promise<Result<MkNoteLabelMap, MkRepositoryError>> {
  if (note_ids.length === 0) return ok({});
  const placeholders = note_ids.map(() => "?").join(", ");
  const result = await db
    .prepare(
      `SELECT nl.note_id AS note_id, l.id AS id, l.owner_id AS owner_id, l.name AS name, l.created_at AS created_at
      FROM mk_note_labels nl JOIN mk_labels l ON l.id = nl.label_id
      WHERE nl.owner_id = ? AND nl.note_id IN (${placeholders})
      ORDER BY l.name ASC, l.id ASC LIMIT ${MK_NOTE_LABEL_LIMIT}`,
    )
    .bind(owner_id, ...note_ids)
    .all<Record<string, unknown>>();
  const entries = result.results
    .map(toNoteLabelEntry)
    .filter((entry): entry is { note_id: string; label: MkLabel } => entry !== undefined);
  return ok(groupLabels(entries));
}
