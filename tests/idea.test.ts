import { describe, expect, it } from "vite-plus/test";
import type { IdeaImage, IdeaNote } from "../src/idea";
import {
  IDEA_BODY_MAX_CODE_POINTS,
  IDEA_COLORS,
  IDEA_MAX_IMAGES,
  IDEA_TITLE_MAX_CODE_POINTS,
  applyIdeaNotePatch,
  applyIdeaNotePreview,
  compareIdeaNotes,
  createIdeaImage,
  createIdeaNote,
  filterIdeaNotes,
  isArchived,
  isDeleted,
  isIdeaBodyValid,
  isIdeaColor,
  isIdeaDateKind,
  isIdeaImage,
  isIdeaImagePositionValid,
  isIdeaNote,
  isIdeaTitleValid,
  matchesIdeaDateRange,
  ideaSortParts,
  noteMatchesFilter,
  parseIdeaNotePatch,
  parseIdeaSort,
  setNoteArchived,
  setNoteDeleted,
  sortIdeaNotes,
  sortIdeaNotesByQuery,
} from "../src/idea";

function noteFixture(overrides: Partial<IdeaNote> = {}): IdeaNote {
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
    preview_title: null,
    preview_description: null,
    preview_image: null,
    preview_domain: null,
    preview_fetched_at: null,
    ...overrides,
  };
}

describe("Ideas note validation", () => {
  it("keeps the MyKeep color palette", () => {
    expect(IDEA_COLORS).toEqual(["default", "red", "orange", "yellow", "green", "blue", "purple"]);
    expect(isIdeaColor("purple")).toBe(true);
    expect(isIdeaColor("cyan")).toBe(false);
  });

  it("accepts titles of 1 to 256 code points", () => {
    expect(isIdeaTitleValid("a")).toBe(true);
    expect(isIdeaTitleValid("a".repeat(IDEA_TITLE_MAX_CODE_POINTS))).toBe(true);
    expect(isIdeaTitleValid("😀".repeat(IDEA_TITLE_MAX_CODE_POINTS))).toBe(true);
    expect(isIdeaTitleValid("")).toBe(false);
    expect(isIdeaTitleValid("a".repeat(IDEA_TITLE_MAX_CODE_POINTS + 1))).toBe(false);
    expect(isIdeaTitleValid("😀".repeat(IDEA_TITLE_MAX_CODE_POINTS + 1))).toBe(false);
  });

  it("accepts bodies up to the task description limit", () => {
    expect(IDEA_BODY_MAX_CODE_POINTS).toBe(16_384);
    expect(isIdeaBodyValid("")).toBe(true);
    expect(isIdeaBodyValid("a".repeat(IDEA_BODY_MAX_CODE_POINTS))).toBe(true);
    expect(isIdeaBodyValid("a".repeat(IDEA_BODY_MAX_CODE_POINTS + 1))).toBe(false);
  });
});

describe("Ideas note creation", () => {
  it("defaults body, color, pinned, and updated_at", () => {
    const created = createIdeaNote({
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
    const created = createIdeaNote({ id: "note-1", owner_id: "local", title: "", created_at: "2026-01-01T00:00:00.000Z" });

    expect(created).toEqual({ ok: false, error: { code: "INVALID_TITLE" } });
  });
});

describe("Ideas note patch", () => {
  it("parses and applies the supported fields", () => {
    const parsed = parseIdeaNotePatch({ title: "updated", body: "text", color: "green", pinned: true });
    if (!parsed.ok) throw new Error("expected a valid patch");

    const note = applyIdeaNotePatch(noteFixture(), parsed.value, "2026-02-01T00:00:00.000Z");

    expect(note).toEqual(
      noteFixture({ title: "updated", body: "text", color: "green", pinned: true, updated_at: "2026-02-01T00:00:00.000Z" }),
    );
  });

  it("rejects an unknown color and a non boolean pinned", () => {
    expect(parseIdeaNotePatch({ color: "cyan" })).toEqual({ ok: false, error: { code: "INVALID_COLOR" } });
    expect(parseIdeaNotePatch({ pinned: "yes" })).toEqual({ ok: false, error: { code: "INVALID_PINNED" } });
  });
});

describe("sortIdeaNotes", () => {
  it("puts pinned notes first and then the most recently updated", () => {
    const notes = [
      noteFixture({ id: "a", updated_at: "2026-01-03T00:00:00.000Z" }),
      noteFixture({ id: "b", pinned: true, updated_at: "2026-01-01T00:00:00.000Z" }),
      noteFixture({ id: "c", updated_at: "2026-01-02T00:00:00.000Z" }),
    ];

    expect(sortIdeaNotes(notes).map((note) => note.id)).toEqual(["b", "a", "c"]);
  });
});

describe("filterIdeaNotes", () => {
  it("filters by pin state, color, and text", () => {
    const notes = [
      noteFixture({ id: "pinned-blue", color: "blue", pinned: true, title: "Alpha" }),
      noteFixture({ id: "plain", body: "alpha beta" }),
    ];

    expect(filterIdeaNotes(notes, { filter: "pinned" }).map((note) => note.id)).toEqual(["pinned-blue"]);
    expect(filterIdeaNotes(notes, { filter: "unpinned" }).map((note) => note.id)).toEqual(["plain"]);
    expect(filterIdeaNotes(notes, { color: "blue" }).map((note) => note.id)).toEqual(["pinned-blue"]);
    expect(filterIdeaNotes(notes, { text: "Alpha" }).map((note) => note.id)).toEqual(["pinned-blue", "plain"]);
  });
});

describe("Ideas note views", () => {
  it("keeps archived and trashed notes out of the default view", () => {
    const notes = [
      noteFixture({ id: "active" }),
      noteFixture({ id: "archived", archived_at: "2026-02-01T00:00:00.000Z" }),
      noteFixture({ id: "trashed", deleted_at: "2026-02-01T00:00:00.000Z" }),
    ];

    expect(filterIdeaNotes(notes, { filter: "notes" }).map((note) => note.id)).toEqual(["active"]);
    expect(filterIdeaNotes(notes, {}).map((note) => note.id)).toEqual(["active"]);
    expect(filterIdeaNotes(notes, { filter: "archived" }).map((note) => note.id)).toEqual(["archived"]);
    expect(filterIdeaNotes(notes, { filter: "trash" }).map((note) => note.id)).toEqual(["trashed"]);
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

function imageFixture(overrides: Partial<IdeaImage> = {}): IdeaImage {
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

describe("Ideas image validation", () => {
  it("caps one note at ten images", () => {
    expect(IDEA_MAX_IMAGES).toBe(10);
  });

  it("accepts only 1-based integer positions", () => {
    expect(isIdeaImagePositionValid(1)).toBe(true);
    expect(isIdeaImagePositionValid(IDEA_MAX_IMAGES)).toBe(true);
    expect(isIdeaImagePositionValid(0)).toBe(false);
    expect(isIdeaImagePositionValid(-1)).toBe(false);
    expect(isIdeaImagePositionValid(1.5)).toBe(false);
    expect(isIdeaImagePositionValid(Number.NaN)).toBe(false);
  });

  it("accepts a complete link record", () => {
    expect(isIdeaImage(imageFixture())).toBe(true);
  });

  it("rejects empty ids and non-positive positions", () => {
    expect(isIdeaImage(imageFixture({ id: "" }))).toBe(false);
    expect(isIdeaImage(imageFixture({ note_id: "" }))).toBe(false);
    expect(isIdeaImage(imageFixture({ owner_id: "" }))).toBe(false);
    expect(isIdeaImage(imageFixture({ image_id: "" }))).toBe(false);
    expect(isIdeaImage(imageFixture({ position: 0 }))).toBe(false);
    expect(isIdeaImage(imageFixture({ created_at: "" }))).toBe(false);
    expect(isIdeaImage(null)).toBe(false);
  });
});

describe("createIdeaImage", () => {
  it("builds a link from valid input", () => {
    const created = createIdeaImage(imageFixture({ position: 2 }));

    expect(created).toEqual({ ok: true, value: imageFixture({ position: 2 }) });
  });

  it("rejects an empty image id and a non-positive position", () => {
    expect(createIdeaImage(imageFixture({ image_id: "" }))).toEqual({ ok: false, error: { code: "INVALID_IMAGE" } });
    expect(createIdeaImage(imageFixture({ position: 0 }))).toEqual({ ok: false, error: { code: "INVALID_IMAGE" } });
  });
});

describe("Ideas date range", () => {
  it("includes both bounds and follows the chosen timestamp", () => {
    const note = noteFixture({ created_at: "2026-01-10T00:00:00.000Z", updated_at: "2026-02-10T00:00:00.000Z" });

    expect(matchesIdeaDateRange(note, "created", "2026-01-10T00:00:00.000Z", "2026-01-10T00:00:00.000Z")).toBe(true);
    expect(matchesIdeaDateRange(note, "created", "2026-01-11T00:00:00.000Z", undefined)).toBe(false);
    expect(matchesIdeaDateRange(note, "updated", "2026-02-10T00:00:00.000Z", undefined)).toBe(true);
    expect(matchesIdeaDateRange(note, "updated", undefined, "2026-01-31T00:00:00.000Z")).toBe(false);
  });

  it("filters notes through the query", () => {
    const notes = [
      noteFixture({ id: "old", created_at: "2025-12-01T00:00:00.000Z" }),
      noteFixture({ id: "new", created_at: "2026-06-01T00:00:00.000Z" }),
    ];

    expect(filterIdeaNotes(notes, { dateKind: "created", from: "2026-01-01T00:00:00.000Z" }).map((note) => note.id)).toEqual([
      "new",
    ]);
    expect(isIdeaDateKind("updated")).toBe(true);
    expect(isIdeaDateKind("deleted")).toBe(false);
  });
});

describe("Ideas sort order", () => {
  it("parses a field and direction", () => {
    expect(parseIdeaSort("updated:desc")).toBe("updated:desc");
    expect(parseIdeaSort("created")).toBe("created:desc");
    expect(parseIdeaSort("created:asc")).toBe("created:asc");
    expect(parseIdeaSort("updated:sideways")).toBeNull();
    expect(parseIdeaSort("deleted:asc")).toBeNull();
    expect(parseIdeaSort(undefined)).toBeNull();
    expect(ideaSortParts("created:asc")).toEqual({ field: "created", direction: "asc" });
  });

  it("keeps pinned notes first and orders the rest by the requested sort", () => {
    const notes = [
      noteFixture({ id: "a", created_at: "2026-01-01T00:00:00.000Z" }),
      noteFixture({ id: "b", created_at: "2026-01-03T00:00:00.000Z" }),
      noteFixture({ id: "c", created_at: "2026-01-02T00:00:00.000Z", pinned: true }),
    ];

    expect(sortIdeaNotesByQuery(notes, "created:asc").map((note) => note.id)).toEqual(["c", "a", "b"]);
    expect(sortIdeaNotesByQuery(notes, "created:desc").map((note) => note.id)).toEqual(["c", "b", "a"]);
  });

  it("compares two notes in both directions", () => {
    const older = noteFixture({ id: "older", updated_at: "2026-01-01T00:00:00.000Z" });
    const newer = noteFixture({ id: "newer", updated_at: "2026-01-02T00:00:00.000Z" });

    expect(compareIdeaNotes(older, newer, "updated:asc")).toBeLessThan(0);
    expect(compareIdeaNotes(older, newer, "updated:desc")).toBeGreaterThan(0);
  });
});

describe("Ideas link preview fields", () => {
  it("applies fetched metadata and keeps empty values null", () => {
    const note = noteFixture();
    const previewed = applyIdeaNotePreview(
      note,
      { title: "T", description: "", image: null, domain: "example.com" },
      "2026-03-01T00:00:00.000Z",
    );

    expect(previewed).toEqual(
      noteFixture({
        preview_title: "T",
        preview_description: null,
        preview_image: null,
        preview_domain: "example.com",
        preview_fetched_at: "2026-03-01T00:00:00.000Z",
      }),
    );
    expect(previewed.updated_at).toBe(note.updated_at);
  });

  it("validates the preview columns on a note record", () => {
    expect(isIdeaNote(noteFixture({ preview_title: "T", preview_image: "https://example.com/a.png" }))).toBe(true);
    expect(isIdeaNote({ ...noteFixture(), preview_title: 1 })).toBe(false);
    expect(isIdeaNote({ ...noteFixture(), preview_fetched_at: 1 })).toBe(false);
  });
});
