import { describe, expect, it } from "vite-plus/test";
import {
  MK_BODY_MAX_CODE_POINTS,
  MK_COLORS,
  MK_TITLE_MAX_CODE_POINTS,
  applyMkNotePatch,
  createMkNote,
  filterMkNotes,
  isMkBodyValid,
  isMkColor,
  isMkTitleValid,
  parseMkNotePatch,
  sortMkNotes,
} from "../src/mk";
import type { MkNote } from "../src/mk";

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
