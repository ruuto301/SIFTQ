import { describe, expect, it } from "vite-plus/test";
import {
  MK_BODY_MAX_CODE_POINTS,
  MK_COLORS,
  MK_LABEL_NAME_MAX_CODE_POINTS,
  MK_MAX_IMAGES,
  MK_MAX_LABELS_PER_NOTE,
  MK_TITLE_MAX_CODE_POINTS,
  applyMkNotePatch,
  createMkImage,
  createMkLabel,
  createMkNote,
  filterMkNotes,
  isArchived,
  isDeleted,
  isMkBodyValid,
  isMkColor,
  isMkImage,
  isMkImagePositionValid,
  isMkLabel,
  isMkLabelNameTaken,
  isMkLabelNameValid,
  isMkTitleValid,
  mkLabelNameKey,
  noteMatchesFilter,
  parseMkLabelIds,
  parseMkNotePatch,
  setNoteArchived,
  setNoteDeleted,
  sortMkNotes,
} from "../src/mk";
import type { MkImage, MkLabel, MkNote } from "../src/mk";

function noteFixture(overrides: Partial<MkNote> = {}): MkNote {
  return {
    id: "note-1",
    owner_id: "local",
    title: "seed note",
    body: "",
    color: "default",
    pinned: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    deleted_at: null,
    ...overrides,
  };
}

function labelFixture(overrides: Partial<MkLabel> = {}): MkLabel {
  return {
    id: "label-1",
    owner_id: "local",
    name: "仕事",
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("MK note validation", () => {
  it("keeps the MyKeep color palette", () => {
    expect(MK_COLORS).toEqual(["default", "red", "orange", "yellow", "green", "blue", "purple"]);
    expect(isMkColor("purple")).toBe(true);
    expect(isMkColor("cyan")).toBe(false);
  });

  it("accepts titles of 1 to 256 code points", () => {
    expect(isMkTitleValid("a")).toBe(true);
    expect(isMkTitleValid("a".repeat(MK_TITLE_MAX_CODE_POINTS))).toBe(true);
    expect(isMkTitleValid("😀".repeat(MK_TITLE_MAX_CODE_POINTS))).toBe(true);
    expect(isMkTitleValid("")).toBe(false);
    expect(isMkTitleValid("a".repeat(MK_TITLE_MAX_CODE_POINTS + 1))).toBe(false);
    expect(isMkTitleValid("😀".repeat(MK_TITLE_MAX_CODE_POINTS + 1))).toBe(false);
  });

  it("accepts bodies up to the task description limit", () => {
    expect(MK_BODY_MAX_CODE_POINTS).toBe(16_384);
    expect(isMkBodyValid("")).toBe(true);
    expect(isMkBodyValid("a".repeat(MK_BODY_MAX_CODE_POINTS))).toBe(true);
    expect(isMkBodyValid("a".repeat(MK_BODY_MAX_CODE_POINTS + 1))).toBe(false);
  });
});

describe("MK note creation", () => {
  it("defaults body, color, pinned, and updated_at", () => {
    const created = createMkNote({
      id: "note-1",
      owner_id: "local",
      title: "memo",
      created_at: "2026-01-01T00:00:00.000Z",
    });

    expect(created).toEqual({
      ok: true,
      value: noteFixture({ title: "memo" }),
    });
  });

  it("rejects an empty title", () => {
    const created = createMkNote({ id: "note-1", owner_id: "local", title: "", created_at: "2026-01-01T00:00:00.000Z" });

    expect(created).toEqual({ ok: false, error: { code: "INVALID_TITLE" } });
  });
});

describe("MK note patch", () => {
  it("parses and applies the supported fields", () => {
    const parsed = parseMkNotePatch({ title: "updated", body: "text", color: "green", pinned: true });
    if (!parsed.ok) throw new Error("expected a valid patch");

    const note = applyMkNotePatch(noteFixture(), parsed.value, "2026-02-01T00:00:00.000Z");

    expect(note).toEqual(
      noteFixture({ title: "updated", body: "text", color: "green", pinned: true, updated_at: "2026-02-01T00:00:00.000Z" }),
    );
  });

  it("rejects an unknown color and a non boolean pinned", () => {
    expect(parseMkNotePatch({ color: "cyan" })).toEqual({ ok: false, error: { code: "INVALID_COLOR" } });
    expect(parseMkNotePatch({ pinned: "yes" })).toEqual({ ok: false, error: { code: "INVALID_PINNED" } });
  });
});

describe("sortMkNotes", () => {
  it("puts pinned notes first and then the most recently updated", () => {
    const notes = [
      noteFixture({ id: "a", updated_at: "2026-01-03T00:00:00.000Z" }),
      noteFixture({ id: "b", pinned: true, updated_at: "2026-01-01T00:00:00.000Z" }),
      noteFixture({ id: "c", updated_at: "2026-01-02T00:00:00.000Z" }),
    ];

    expect(sortMkNotes(notes).map((note) => note.id)).toEqual(["b", "a", "c"]);
  });
});

describe("filterMkNotes", () => {
  it("filters by pin state, color, and text", () => {
    const notes = [
      noteFixture({ id: "pinned-blue", color: "blue", pinned: true, title: "Alpha" }),
      noteFixture({ id: "plain", body: "alpha beta" }),
    ];

    expect(filterMkNotes(notes, { filter: "pinned" }).map((note) => note.id)).toEqual(["pinned-blue"]);
    expect(filterMkNotes(notes, { filter: "unpinned" }).map((note) => note.id)).toEqual(["plain"]);
    expect(filterMkNotes(notes, { color: "blue" }).map((note) => note.id)).toEqual(["pinned-blue"]);
    expect(filterMkNotes(notes, { text: "Alpha" }).map((note) => note.id)).toEqual(["pinned-blue", "plain"]);
  });
});

describe("MK note views", () => {
  it("keeps archived and trashed notes out of the default view", () => {
    const notes = [
      noteFixture({ id: "active" }),
      noteFixture({ id: "archived", archived_at: "2026-02-01T00:00:00.000Z" }),
      noteFixture({ id: "trashed", deleted_at: "2026-02-01T00:00:00.000Z" }),
    ];

    expect(filterMkNotes(notes, { filter: "notes" }).map((note) => note.id)).toEqual(["active"]);
    expect(filterMkNotes(notes, {}).map((note) => note.id)).toEqual(["active"]);
    expect(filterMkNotes(notes, { filter: "archived" }).map((note) => note.id)).toEqual(["archived"]);
    expect(filterMkNotes(notes, { filter: "trash" }).map((note) => note.id)).toEqual(["trashed"]);
  });

  it("counts a trashed note as trash even when it was archived first", () => {
    const both = noteFixture({ id: "both", archived_at: "2026-02-01T00:00:00.000Z", deleted_at: "2026-02-02T00:00:00.000Z" });

    expect(noteMatchesFilter(both, "trash")).toBe(true);
    expect(noteMatchesFilter(both, "archived")).toBe(false);
    expect(noteMatchesFilter(both, "notes")).toBe(false);
  });

  it("splits the active view by pin state", () => {
    const pinned = noteFixture({ id: "pinned", pinned: true });
    const plain = noteFixture({ id: "plain" });

    expect(noteMatchesFilter(pinned, "pinned")).toBe(true);
    expect(noteMatchesFilter(pinned, "unpinned")).toBe(false);
    expect(noteMatchesFilter(plain, "unpinned")).toBe(true);
    expect(isArchived(pinned)).toBe(false);
    expect(isDeleted(pinned)).toBe(false);
  });

  it("sets and clears the archive and trash timestamps", () => {
    const archived = setNoteArchived(noteFixture(), true, "2026-03-01T00:00:00.000Z");
    expect(archived.archived_at).toBe("2026-03-01T00:00:00.000Z");
    expect(archived.updated_at).toBe("2026-03-01T00:00:00.000Z");
    expect(setNoteArchived(archived, false, "2026-03-02T00:00:00.000Z").archived_at).toBeNull();

    const trashed = setNoteDeleted(noteFixture(), true, "2026-03-03T00:00:00.000Z");
    expect(trashed.deleted_at).toBe("2026-03-03T00:00:00.000Z");
    expect(setNoteDeleted(trashed, false, "2026-03-04T00:00:00.000Z").deleted_at).toBeNull();
  });
});

describe("MK labels", () => {
  it("accepts names of 1 to 100 code points after trimming", () => {
    expect(isMkLabelNameValid("a")).toBe(true);
    expect(isMkLabelNameValid("  仕事  ")).toBe(true);
    expect(isMkLabelNameValid("😀".repeat(MK_LABEL_NAME_MAX_CODE_POINTS))).toBe(true);
    expect(isMkLabelNameValid("")).toBe(false);
    expect(isMkLabelNameValid("   ")).toBe(false);
    expect(isMkLabelNameValid("a".repeat(MK_LABEL_NAME_MAX_CODE_POINTS + 1))).toBe(false);
    expect(MK_LABEL_NAME_MAX_CODE_POINTS).toBe(100);
  });

  it("keys names case-insensitively and detects duplicates", () => {
    expect(mkLabelNameKey(" Work ")).toBe("work");
    const labels = [labelFixture({ id: "a", name: "Work" }), labelFixture({ id: "b", name: "私用" })];

    expect(isMkLabelNameTaken(labels, "work")).toBe(true);
    expect(isMkLabelNameTaken(labels, "WORK", "a")).toBe(false);
    expect(isMkLabelNameTaken(labels, "私用", "b")).toBe(false);
    expect(isMkLabelNameTaken(labels, "new")).toBe(false);
  });

  it("normalizes a created label and rejects invalid names", () => {
    const created = createMkLabel({ id: "label-1", owner_id: "local", name: "  買い物  ", created_at: "2026-01-01T00:00:00.000Z" });

    expect(created).toEqual({ ok: true, value: labelFixture({ name: "買い物" }) });
    expect(createMkLabel({ id: "label-1", owner_id: "local", name: "   ", created_at: "2026-01-01T00:00:00.000Z" })).toEqual({
      ok: false,
      error: { code: "INVALID_LABEL_NAME" },
    });
  });

  it("validates a label record", () => {
    expect(isMkLabel(labelFixture())).toBe(true);
    expect(isMkLabel(labelFixture({ id: "" }))).toBe(false);
    expect(isMkLabel(labelFixture({ owner_id: "" }))).toBe(false);
    expect(isMkLabel(labelFixture({ name: "" }))).toBe(false);
    expect(isMkLabel(labelFixture({ created_at: "" }))).toBe(false);
    expect(isMkLabel(null)).toBe(false);
  });

  it("parses note label id lists", () => {
    expect(parseMkLabelIds([])).toEqual([]);
    expect(parseMkLabelIds(["a", "b"])).toEqual(["a", "b"]);
    expect(parseMkLabelIds(["a", "a"])).toBeNull();
    expect(parseMkLabelIds(["a", ""])).toBeNull();
    expect(parseMkLabelIds(["a", 1])).toBeNull();
    expect(parseMkLabelIds("a")).toBeNull();
    expect(parseMkLabelIds(Array.from({ length: MK_MAX_LABELS_PER_NOTE + 1 }, (_, index) => `l${index}`))).toBeNull();
  });
});

function imageFixture(overrides: Partial<MkImage> = {}): MkImage {
  return {
    id: "link-1",
    note_id: "note-1",
    owner_id: "local",
    image_id: "image-1",
    position: 1,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("MK image validation", () => {
  it("caps one note at ten images", () => {
    expect(MK_MAX_IMAGES).toBe(10);
  });

  it("accepts only 1-based integer positions", () => {
    expect(isMkImagePositionValid(1)).toBe(true);
    expect(isMkImagePositionValid(MK_MAX_IMAGES)).toBe(true);
    expect(isMkImagePositionValid(0)).toBe(false);
    expect(isMkImagePositionValid(-1)).toBe(false);
    expect(isMkImagePositionValid(1.5)).toBe(false);
    expect(isMkImagePositionValid(Number.NaN)).toBe(false);
  });

  it("accepts a complete link record", () => {
    expect(isMkImage(imageFixture())).toBe(true);
  });

  it("rejects empty ids and non-positive positions", () => {
    expect(isMkImage(imageFixture({ id: "" }))).toBe(false);
    expect(isMkImage(imageFixture({ note_id: "" }))).toBe(false);
    expect(isMkImage(imageFixture({ owner_id: "" }))).toBe(false);
    expect(isMkImage(imageFixture({ image_id: "" }))).toBe(false);
    expect(isMkImage(imageFixture({ position: 0 }))).toBe(false);
    expect(isMkImage(imageFixture({ created_at: "" }))).toBe(false);
    expect(isMkImage(null)).toBe(false);
  });
});

describe("createMkImage", () => {
  it("builds a link from valid input", () => {
    const created = createMkImage(imageFixture({ position: 2 }));

    expect(created).toEqual({ ok: true, value: imageFixture({ position: 2 }) });
  });

  it("rejects an empty image id and a non-positive position", () => {
    expect(createMkImage(imageFixture({ image_id: "" }))).toEqual({ ok: false, error: { code: "INVALID_IMAGE" } });
    expect(createMkImage(imageFixture({ position: 0 }))).toEqual({ ok: false, error: { code: "INVALID_IMAGE" } });
  });
});
