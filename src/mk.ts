import { TASK_DESCRIPTION_MAX_CODE_POINTS, TASK_TITLE_MAX_CODE_POINTS, err, isTaskDescriptionValid, isTaskTitleValid, ok } from "./task";
import type { Result } from "./task";

export const MK_COLORS = ["default", "red", "orange", "yellow", "green", "blue", "purple"] as const;
export type MkColor = (typeof MK_COLORS)[number];

export const MK_FILTERS = ["all", "pinned", "unpinned"] as const;
export type MkFilter = (typeof MK_FILTERS)[number];

export const MK_TITLE_MAX_CODE_POINTS = TASK_TITLE_MAX_CODE_POINTS;
export const MK_BODY_MAX_CODE_POINTS = TASK_DESCRIPTION_MAX_CODE_POINTS;

export type MkNote = {
  id: string;
  owner_id: string;
  title: string;
  body: string;
  color: MkColor;
  pinned: boolean;
  created_at: string;
  updated_at: string;
};

export type MkErrorCode =
  | "INVALID_TITLE"
  | "INVALID_BODY"
  | "INVALID_COLOR"
  | "INVALID_FILTER"
  | "INVALID_PINNED"
  | "INVALID_BULK_INPUT"
  | "NOT_FOUND";

export type MkError = { code: MkErrorCode };

export function isMkRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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
    typeof value["updated_at"] === "string"
  );
}

export function isMkFilter(value: unknown): value is MkFilter {
  return typeof value === "string" && MK_FILTERS.some((filter) => filter === value);
}

export function isMkTitleValid(title: string): boolean {
  return isTaskTitleValid(title);
}

export function isMkBodyValid(body: string): boolean {
  return isTaskDescriptionValid(body);
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
};

function matchesText(note: MkNote, text: string): boolean {
  const needle = text.trim().toLowerCase();
  if (needle === "") return true;
  return `${note.title}\n${note.body}`.toLowerCase().includes(needle);
}

export function matchesMkNoteQuery(note: MkNote, query: MkNoteQuery): boolean {
  if (query.filter === "pinned" && !note.pinned) return false;
  if (query.filter === "unpinned" && note.pinned) return false;
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
  });
}
