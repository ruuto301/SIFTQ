import { TASK_DESCRIPTION_MAX_CODE_POINTS, TASK_TITLE_MAX_CODE_POINTS, err, isTaskDescriptionValid, isTaskTitleValid, ok } from "./task";
import type { Result } from "./task";

export const IDEA_COLORS = ["default", "red", "orange", "yellow", "green", "blue", "purple"] as const;
export type IdeaColor = (typeof IDEA_COLORS)[number];

/** `notes` is the default view; archived and trashed notes leave it. */
export const IDEA_FILTERS = ["notes", "pinned", "unpinned", "archived", "trash"] as const;
export type IdeaFilter = (typeof IDEA_FILTERS)[number];

export const IDEA_TITLE_MAX_CODE_POINTS = TASK_TITLE_MAX_CODE_POINTS;
export const IDEA_BODY_MAX_CODE_POINTS = TASK_DESCRIPTION_MAX_CODE_POINTS;
export const IDEA_MAX_IMAGES = 10;

/** The timestamp a date range filters on. */
export const IDEA_DATE_KINDS = ["created", "updated"] as const;
export type IdeaDateKind = (typeof IDEA_DATE_KINDS)[number];

export const IDEA_SORT_FIELDS = ["updated", "created"] as const;
export const IDEA_SORT_DIRECTIONS = ["asc", "desc"] as const;
export type IdeaSortField = (typeof IDEA_SORT_FIELDS)[number];
export type IdeaSortDirection = (typeof IDEA_SORT_DIRECTIONS)[number];
/** A `field:direction` pair such as `updated:desc`, as carried by the `sort` query. */
export type IdeaSort = `${IdeaSortField}:${IdeaSortDirection}`;
export const IDEA_DEFAULT_SORT: IdeaSort = "updated:desc";

/** The link card metadata fetched from the first URL in a note. */
export type IdeaLinkPreview = {
  title: string;
  description: string;
  image: string | null;
  domain: string;
};

/** The link card metadata columns, shared by the note and its persistence layer. */
export type IdeaPreviewFields = {
  preview_title: string | null;
  preview_description: string | null;
  preview_image: string | null;
  preview_domain: string | null;
  preview_fetched_at: string | null;
};

/** Link preview metadata is empty until a preview is fetched. */
export const EMPTY_IDEA_PREVIEW = {
  preview_title: null,
  preview_description: null,
  preview_image: null,
  preview_domain: null,
  preview_fetched_at: null,
} as const;

export type IdeaNote = {
  id: string;
  owner_id: string;
  title: string;
  body: string;
  color: IdeaColor;
  pinned: boolean;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  deleted_at: string | null;
} & IdeaPreviewFields;

export type IdeaImage = {
  id: string;
  note_id: string;
  owner_id: string;
  image_id: string;
  position: number;
  created_at: string;
};

export type IdeaErrorCode =
  | "INVALID_TITLE"
  | "INVALID_BODY"
  | "INVALID_COLOR"
  | "INVALID_FILTER"
  | "INVALID_PINNED"
  | "INVALID_INPUT"
  | "INVALID_BULK_INPUT"
  | "INVALID_IMAGE"
  | "INVALID_DATE"
  | "INVALID_SORT"
  | "INVALID_URL"
  | "PREVIEW_FAILED"
  | "INVALID_STATE"
  | "IMAGE_LIMIT_EXCEEDED"
  | "CONFLICT"
  | "NOT_FOUND";

export type IdeaError = { code: IdeaErrorCode };

export function isIdeaRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

export function isIdeaColor(value: unknown): value is IdeaColor {
  return typeof value === "string" && IDEA_COLORS.some((color) => color === value);
}

export function isIdeaDateKind(value: unknown): value is IdeaDateKind {
  return typeof value === "string" && IDEA_DATE_KINDS.some((kind) => kind === value);
}

export function isIdeaSortField(value: unknown): value is IdeaSortField {
  return typeof value === "string" && IDEA_SORT_FIELDS.some((field) => field === value);
}

export function isIdeaSortDirection(value: unknown): value is IdeaSortDirection {
  return typeof value === "string" && IDEA_SORT_DIRECTIONS.some((direction) => direction === value);
}

/** Reads a `field:direction` sort; a bare field keeps the default descending direction. */
export function parseIdeaSort(value: unknown): IdeaSort | null {
  if (typeof value !== "string") return null;
  const separator = value.indexOf(":");
  const field = separator < 0 ? value : value.slice(0, separator);
  const direction = separator < 0 ? "desc" : value.slice(separator + 1);
  return isIdeaSortField(field) && isIdeaSortDirection(direction) ? `${field}:${direction}` : null;
}

export function ideaSortParts(sort: IdeaSort): { field: IdeaSortField; direction: IdeaSortDirection } {
  const separator = sort.indexOf(":");
  const field = sort.slice(0, separator);
  const direction = sort.slice(separator + 1);
  return {
    field: isIdeaSortField(field) ? field : "updated",
    direction: isIdeaSortDirection(direction) ? direction : "desc",
  };
}

function hasIdeaPreviewFields(value: Record<string, unknown>): boolean {
  return (
    isNullableString(value["preview_title"]) &&
    isNullableString(value["preview_description"]) &&
    isNullableString(value["preview_image"]) &&
    isNullableString(value["preview_domain"]) &&
    isNullableString(value["preview_fetched_at"])
  );
}

export function isIdeaNote(value: unknown): value is IdeaNote {
  if (!isIdeaRecord(value)) return false;
  return (
    typeof value["id"] === "string" &&
    typeof value["owner_id"] === "string" &&
    typeof value["title"] === "string" &&
    typeof value["body"] === "string" &&
    isIdeaColor(value["color"]) &&
    typeof value["pinned"] === "boolean" &&
    typeof value["created_at"] === "string" &&
    typeof value["updated_at"] === "string" &&
    isNullableString(value["archived_at"]) &&
    isNullableString(value["deleted_at"]) &&
    hasIdeaPreviewFields(value)
  );
}

export function isIdeaFilter(value: unknown): value is IdeaFilter {
  return typeof value === "string" && IDEA_FILTERS.some((filter) => filter === value);
}

/** Reads a list of non-empty unique ids, or null when malformed or over the limit. */
export function parseIdeaIdList(value: unknown, max: number): string[] | null {
  if (!Array.isArray(value) || value.length > max) return null;
  const ids = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string" || item === "") return null;
    ids.add(item);
  }
  return ids.size === value.length ? [...ids] : null;
}

/** Image positions are 1-based slots so the first attached image sorts first. */
export function isIdeaImagePositionValid(position: number): boolean {
  return Number.isInteger(position) && position >= 1;
}

export function isIdeaImage(value: unknown): value is IdeaImage {
  if (!isIdeaRecord(value)) return false;
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
    isIdeaImagePositionValid(position) &&
    typeof created_at === "string" &&
    created_at !== ""
  );
}

export type CreateIdeaImageInput = {
  id: string;
  note_id: string;
  owner_id: string;
  image_id: string;
  position: number;
  created_at: string;
};

/** The link row that attaches an uploaded image to a note. */
export function createIdeaImage(input: CreateIdeaImageInput): Result<IdeaImage, IdeaError> {
  if (!isIdeaImage(input)) return err({ code: "INVALID_IMAGE" });
  return ok(input);
}

export function isIdeaTitleValid(title: string): boolean {
  return isTaskTitleValid(title);
}

export function isIdeaBodyValid(body: string): boolean {
  return isTaskDescriptionValid(body);
}

export function isArchived(note: IdeaNote): boolean {
  return note.archived_at !== null;
}

export function isDeleted(note: IdeaNote): boolean {
  return note.deleted_at !== null;
}

/** A note belongs to exactly one view: trashed wins over archived, and both leave `notes`. */
export function noteMatchesFilter(note: IdeaNote, filter: IdeaFilter): boolean {
  if (isDeleted(note)) return filter === "trash";
  if (filter === "trash") return false;
  if (isArchived(note)) return filter === "archived";
  if (filter === "archived") return false;
  if (filter === "pinned") return note.pinned;
  if (filter === "unpinned") return !note.pinned;
  return true;
}

/** Pinned notes first, then the requested sort, then id for a stable order. */
export function sortIdeaNotesByQuery<T extends IdeaNote>(notes: readonly T[], sort: IdeaSort = IDEA_DEFAULT_SORT): T[] {
  return [...notes].sort((left, right) => compareIdeaNotes(left, right, sort));
}

function ideaSortValue(note: IdeaNote, field: IdeaSortField): string {
  return field === "created" ? note.created_at : note.updated_at;
}

export function compareIdeaNotes(left: IdeaNote, right: IdeaNote, sort: IdeaSort): number {
  const pinned = Number(right.pinned) - Number(left.pinned);
  if (pinned !== 0) return pinned;
  const parts = ideaSortParts(sort);
  const order = parts.direction === "asc" ? -1 : 1;
  const values = ideaSortValue(right, parts.field).localeCompare(ideaSortValue(left, parts.field)) * order;
  return values !== 0 ? values : left.id.localeCompare(right.id);
}

/** Pinned notes first, then most recently updated, then id for a stable order. */
export function sortIdeaNotes<T extends IdeaNote>(notes: readonly T[]): T[] {
  return sortIdeaNotesByQuery(notes, IDEA_DEFAULT_SORT);
}

export type IdeaNoteQuery = {
  filter?: IdeaFilter;
  text?: string;
  color?: IdeaColor;
  dateKind?: IdeaDateKind;
  /** Inclusive lower bound, as an ISO instant. */
  from?: string;
  /** Inclusive upper bound, as an ISO instant. */
  to?: string;
  sort?: IdeaSort;
};

function matchesText(note: IdeaNote, text: string): boolean {
  const needle = text.trim().toLowerCase();
  if (needle === "") return true;
  return `${note.title}\n${note.body}`.toLowerCase().includes(needle);
}

/** Date bounds compare as ISO instants, so a missing bound leaves that side open. */
export function matchesIdeaDateRange(note: IdeaNote, kind: IdeaDateKind, from?: string, to?: string): boolean {
  const value = ideaSortValue(note, kind);
  if (from !== undefined && value < from) return false;
  if (to !== undefined && value > to) return false;
  return true;
}

export function matchesIdeaNoteQuery(note: IdeaNote, query: IdeaNoteQuery): boolean {
  if (!noteMatchesFilter(note, query.filter ?? "notes")) return false;
  if (query.color !== undefined && note.color !== query.color) return false;
  if (query.dateKind !== undefined && !matchesIdeaDateRange(note, query.dateKind, query.from, query.to)) return false;
  return matchesText(note, query.text ?? "");
}

export function filterIdeaNotes<T extends IdeaNote>(notes: readonly T[], query: IdeaNoteQuery): T[] {
  return notes.filter((note) => matchesIdeaNoteQuery(note, query));
}

export type IdeaNotePatch = {
  title?: string;
  body?: string;
  color?: IdeaColor;
  pinned?: boolean;
};


/** Preview metadata keeps empty fields null so the card can fall back to a plain link. */
export function applyIdeaNotePreview(note: IdeaNote, preview: IdeaLinkPreview, fetched_at: string): IdeaNote {
  return {
    ...note,
    preview_title: preview.title === "" ? null : preview.title,
    preview_description: preview.description === "" ? null : preview.description,
    preview_image: preview.image,
    preview_domain: preview.domain === "" ? null : preview.domain,
    preview_fetched_at: fetched_at,
  };
}

export function parseIdeaNotePatch(body: Record<string, unknown>): Result<IdeaNotePatch, IdeaError> {
  const patch: IdeaNotePatch = {};

  if (typeof body["title"] === "string") {
    const title = body["title"].trim();
    if (!isIdeaTitleValid(title)) return err({ code: "INVALID_TITLE" });
    patch.title = title;
  }
  if (typeof body["body"] === "string") {
    if (!isIdeaBodyValid(body["body"])) return err({ code: "INVALID_BODY" });
    patch.body = body["body"];
  }
  if (body["color"] !== undefined) {
    const color = body["color"];
    if (!isIdeaColor(color)) return err({ code: "INVALID_COLOR" });
    patch.color = color;
  }
  if (body["pinned"] !== undefined) {
    const pinned = body["pinned"];
    if (typeof pinned !== "boolean") return err({ code: "INVALID_PINNED" });
    patch.pinned = pinned;
  }

  return ok(patch);
}

export function applyIdeaNotePatch(note: IdeaNote, patch: IdeaNotePatch, updated_at: string): IdeaNote {
  return { ...note, ...patch, updated_at };
}

export function changeIdeaNoteColor(note: IdeaNote, color: IdeaColor, updated_at: string): IdeaNote {
  return { ...note, color, updated_at };
}

export function changeIdeaNotePinned(note: IdeaNote, pinned: boolean, updated_at: string): IdeaNote {
  return { ...note, pinned, updated_at };
}

export function setNoteArchived(note: IdeaNote, archived: boolean, updated_at: string): IdeaNote {
  return { ...note, archived_at: archived ? updated_at : null, updated_at };
}

export function setNoteDeleted(note: IdeaNote, deleted: boolean, updated_at: string): IdeaNote {
  return { ...note, deleted_at: deleted ? updated_at : null, updated_at };
}

export type IdeaNoteCounts = {
  notes: number;
  pinned: number;
  unpinned: number;
  archived: number;
  trash: number;
};

/** Sidebar counts: note views plus one entry per label id. */


export type CreateIdeaNoteInput = {
  id: string;
  owner_id: string;
  title: string;
  body?: string;
  color?: IdeaColor;
  pinned?: boolean;
  created_at: string;
};

export function createIdeaNote(input: CreateIdeaNoteInput): Result<IdeaNote, IdeaError> {
  if (!isIdeaTitleValid(input.title)) return err({ code: "INVALID_TITLE" });
  const body = input.body ?? "";
  if (!isIdeaBodyValid(body)) return err({ code: "INVALID_BODY" });
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
    ...EMPTY_IDEA_PREVIEW,
  });
}
