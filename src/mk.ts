import { TASK_DESCRIPTION_MAX_CODE_POINTS, TASK_TITLE_MAX_CODE_POINTS, err, isTaskDescriptionValid, isTaskTitleValid, ok } from "./task";
import type { Result } from "./task";

export const MK_COLORS = ["default", "red", "orange", "yellow", "green", "blue", "purple"] as const;
export type MkColor = (typeof MK_COLORS)[number];

/** `notes` is the default view; archived and trashed notes leave it. */
export const MK_FILTERS = ["notes", "pinned", "unpinned", "archived", "trash"] as const;
export type MkFilter = (typeof MK_FILTERS)[number];

export const MK_TITLE_MAX_CODE_POINTS = TASK_TITLE_MAX_CODE_POINTS;
export const MK_BODY_MAX_CODE_POINTS = TASK_DESCRIPTION_MAX_CODE_POINTS;
export const MK_LABEL_NAME_MAX_CODE_POINTS = 100;
export const MK_MAX_LABELS_PER_NOTE = 20;
export const MK_MAX_IMAGES = 10;

export type MkNote = {
  id: string;
  owner_id: string;
  title: string;
  body: string;
  color: MkColor;
  pinned: boolean;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  deleted_at: string | null;
};

export type MkLabel = {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
};

/** The link row that attaches a label to a note. */
export type MkNoteLabel = {
  note_id: string;
  label_id: string;
  owner_id: string;
};

/** Labels grouped by note id, so a list render avoids one query per note. */
export type MkNoteLabelMap = Record<string, MkLabel[]>;

export type MkImage = {
  id: string;
  note_id: string;
  owner_id: string;
  image_id: string;
  position: number;
  created_at: string;
};

export type MkErrorCode =
  | "INVALID_TITLE"
  | "INVALID_BODY"
  | "INVALID_COLOR"
  | "INVALID_FILTER"
  | "INVALID_PINNED"
  | "INVALID_INPUT"
  | "INVALID_BULK_INPUT"
  | "INVALID_LABEL_NAME"
  | "INVALID_LABEL"
  | "INVALID_IMAGE"
  | "INVALID_STATE"
  | "IMAGE_LIMIT_EXCEEDED"
  | "CONFLICT"
  | "NOT_FOUND";

export type MkError = { code: MkErrorCode };

export function isMkRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

export function isMkColor(value: unknown): value is MkColor {
  return typeof value === "string" && MK_COLORS.some((color) => color === value);
}

export function isMkNote(value: unknown): value is MkNote {
  if (!isMkRecord(value)) return false;
  return (
    typeof value["id"] === "string" &&
    typeof value["owner_id"] === "string" &&
    typeof value["title"] === "string" &&
    typeof value["body"] === "string" &&
    isMkColor(value["color"]) &&
    typeof value["pinned"] === "boolean" &&
    typeof value["created_at"] === "string" &&
    typeof value["updated_at"] === "string" &&
    isNullableString(value["archived_at"]) &&
    isNullableString(value["deleted_at"])
  );
}

export function isMkFilter(value: unknown): value is MkFilter {
  return typeof value === "string" && MK_FILTERS.some((filter) => filter === value);
}

export function isMkLabelNameValid(name: string): boolean {
  const length = Array.from(name.trim()).length;
  return length >= 1 && length <= MK_LABEL_NAME_MAX_CODE_POINTS;
}

/** Label names are stored trimmed and compared case-insensitively. */
export function normalizeMkLabelName(name: string): string {
  return name.trim();
}

export function mkLabelNameKey(name: string): string {
  return normalizeMkLabelName(name).toLowerCase();
}

export function isMkLabelNameTaken(labels: readonly MkLabel[], name: string, exceptId?: string): boolean {
  const key = mkLabelNameKey(name);
  return labels.some((label) => label.id !== exceptId && mkLabelNameKey(label.name) === key);
}

export function isMkLabel(value: unknown): value is MkLabel {
  if (!isMkRecord(value)) return false;
  const { id, owner_id, name, created_at } = value;
  return (
    typeof id === "string" &&
    id !== "" &&
    typeof owner_id === "string" &&
    owner_id !== "" &&
    typeof name === "string" &&
    isMkLabelNameValid(name) &&
    typeof created_at === "string" &&
    created_at !== ""
  );
}

export type CreateMkLabelInput = {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
};

export function createMkLabel(input: CreateMkLabelInput): Result<MkLabel, MkError> {
  const name = normalizeMkLabelName(input.name);
  if (!isMkLabelNameValid(name)) return err({ code: "INVALID_LABEL_NAME" });
  return ok({ ...input, name });
}

/** Reads a list of non-empty unique ids, or null when malformed or over the limit. */
export function parseMkIdList(value: unknown, max: number): string[] | null {
  if (!Array.isArray(value) || value.length > max) return null;
  const ids = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string" || item === "") return null;
    ids.add(item);
  }
  return ids.size === value.length ? [...ids] : null;
}

/** Accepts a label id list for `setNoteLabels`; an empty list clears the note. */
export function parseMkLabelIds(value: unknown): string[] | null {
  return parseMkIdList(value, MK_MAX_LABELS_PER_NOTE);
}

/** Image positions are 1-based slots so the first attached image sorts first. */
export function isMkImagePositionValid(position: number): boolean {
  return Number.isInteger(position) && position >= 1;
}

export function isMkImage(value: unknown): value is MkImage {
  if (!isMkRecord(value)) return false;
  const { id, note_id, owner_id, image_id, position, created_at } = value;
  return (
    typeof id === "string" &&
    id !== "" &&
    typeof note_id === "string" &&
    note_id !== "" &&
    typeof owner_id === "string" &&
    owner_id !== "" &&
    typeof image_id === "string" &&
    image_id !== "" &&
    typeof position === "number" &&
    isMkImagePositionValid(position) &&
    typeof created_at === "string" &&
    created_at !== ""
  );
}

export type CreateMkImageInput = {
  id: string;
  note_id: string;
  owner_id: string;
  image_id: string;
  position: number;
  created_at: string;
};

/** The link row that attaches an uploaded image to a note. */
export function createMkImage(input: CreateMkImageInput): Result<MkImage, MkError> {
  if (!isMkImage(input)) return err({ code: "INVALID_IMAGE" });
  return ok(input);
}

export function isMkTitleValid(title: string): boolean {
  return isTaskTitleValid(title);
}

export function isMkBodyValid(body: string): boolean {
  return isTaskDescriptionValid(body);
}

export function isArchived(note: MkNote): boolean {
  return note.archived_at !== null;
}

export function isDeleted(note: MkNote): boolean {
  return note.deleted_at !== null;
}

/** A note belongs to exactly one view: trashed wins over archived, and both leave `notes`. */
export function noteMatchesFilter(note: MkNote, filter: MkFilter): boolean {
  if (isDeleted(note)) return filter === "trash";
  if (filter === "trash") return false;
  if (isArchived(note)) return filter === "archived";
  if (filter === "archived") return false;
  if (filter === "pinned") return note.pinned;
  if (filter === "unpinned") return !note.pinned;
  return true;
}

/** Pinned notes first, then most recently updated, then id for a stable order. */
export function sortMkNotes<T extends MkNote>(notes: readonly T[]): T[] {
  return [...notes].sort(
    (left, right) =>
      Number(right.pinned) - Number(left.pinned) ||
      right.updated_at.localeCompare(left.updated_at) ||
      left.id.localeCompare(right.id),
  );
}

export type MkNoteQuery = {
  filter?: MkFilter;
  text?: string;
  color?: MkColor;
  /** Repository-side filter; a note does not carry its labels. */
  labelId?: string;
};

function matchesText(note: MkNote, text: string): boolean {
  const needle = text.trim().toLowerCase();
  if (needle === "") return true;
  return `${note.title}\n${note.body}`.toLowerCase().includes(needle);
}

export function matchesMkNoteQuery(note: MkNote, query: MkNoteQuery): boolean {
  if (!noteMatchesFilter(note, query.filter ?? "notes")) return false;
  if (query.color !== undefined && note.color !== query.color) return false;
  return matchesText(note, query.text ?? "");
}

export function filterMkNotes<T extends MkNote>(notes: readonly T[], query: MkNoteQuery): T[] {
  return notes.filter((note) => matchesMkNoteQuery(note, query));
}

export type MkNotePatch = {
  title?: string;
  body?: string;
  color?: MkColor;
  pinned?: boolean;
};

export function parseMkNotePatch(body: Record<string, unknown>): Result<MkNotePatch, MkError> {
  const patch: MkNotePatch = {};

  if (typeof body["title"] === "string") {
    const title = body["title"].trim();
    if (!isMkTitleValid(title)) return err({ code: "INVALID_TITLE" });
    patch.title = title;
  }
  if (typeof body["body"] === "string") {
    if (!isMkBodyValid(body["body"])) return err({ code: "INVALID_BODY" });
    patch.body = body["body"];
  }
  if (body["color"] !== undefined) {
    const color = body["color"];
    if (!isMkColor(color)) return err({ code: "INVALID_COLOR" });
    patch.color = color;
  }
  if (body["pinned"] !== undefined) {
    const pinned = body["pinned"];
    if (typeof pinned !== "boolean") return err({ code: "INVALID_PINNED" });
    patch.pinned = pinned;
  }

  return ok(patch);
}

export function applyMkNotePatch(note: MkNote, patch: MkNotePatch, updated_at: string): MkNote {
  return { ...note, ...patch, updated_at };
}

export function changeMkNoteColor(note: MkNote, color: MkColor, updated_at: string): MkNote {
  return { ...note, color, updated_at };
}

export function changeMkNotePinned(note: MkNote, pinned: boolean, updated_at: string): MkNote {
  return { ...note, pinned, updated_at };
}

export function setNoteArchived(note: MkNote, archived: boolean, updated_at: string): MkNote {
  return { ...note, archived_at: archived ? updated_at : null, updated_at };
}

export function setNoteDeleted(note: MkNote, deleted: boolean, updated_at: string): MkNote {
  return { ...note, deleted_at: deleted ? updated_at : null, updated_at };
}

export type MkNoteCounts = {
  notes: number;
  pinned: number;
  unpinned: number;
  archived: number;
  trash: number;
};

/** Sidebar counts: note views plus one entry per label id. */
export type MkCounts = MkNoteCounts & { labels: Record<string, number> };

export type CreateMkNoteInput = {
  id: string;
  owner_id: string;
  title: string;
  body?: string;
  color?: MkColor;
  pinned?: boolean;
  created_at: string;
};

export function createMkNote(input: CreateMkNoteInput): Result<MkNote, MkError> {
  if (!isMkTitleValid(input.title)) return err({ code: "INVALID_TITLE" });
  const body = input.body ?? "";
  if (!isMkBodyValid(body)) return err({ code: "INVALID_BODY" });
  return ok({
    id: input.id,
    owner_id: input.owner_id,
    title: input.title,
    body,
    color: input.color ?? "default",
    pinned: input.pinned ?? false,
    created_at: input.created_at,
    updated_at: input.created_at,
    archived_at: null,
    deleted_at: null,
  });
}
