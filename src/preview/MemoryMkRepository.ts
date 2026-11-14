import { changeMkNoteColor, changeMkNotePinned, filterMkNotes, sortMkNotes } from "../mk";
import type { MkColor, MkNote, MkNoteQuery } from "../mk";
import { err, ok } from "../task";
import type { Result } from "../task";
import type { MkRepository, MkRepositoryError } from "../repository/mk-repository";

export function createMemoryMkRepository(initialNotes: readonly MkNote[] = []): MkRepository {
  const notes = new Map(initialNotes.map((note) => [note.id, note]));

  return {
    list: (owner_id, query) => listNotes(notes, owner_id, query),
    find: (id, owner_id) => findNote(notes, id, owner_id),
    insert: (note) => insertNote(notes, note),
    update: (note) => updateNote(notes, note),
    remove: (id, owner_id) => removeNote(notes, id, owner_id),
    bulkUpdateColor: (ids, owner_id, color) => bulkChange(notes, ids, owner_id, { kind: "color", color }),
    bulkPin: (ids, owner_id, pinned) => bulkChange(notes, ids, owner_id, { kind: "pin", pinned }),
    bulkRemove: (ids, owner_id) => bulkRemove(notes, ids, owner_id),
  };
}

type BulkChange = { kind: "color"; color: MkColor } | { kind: "pin"; pinned: boolean };

async function listNotes(
  notes: Map<string, MkNote>,
  owner_id: string,
  query: MkNoteQuery | undefined,
): Promise<Result<MkNote[], MkRepositoryError>> {
  const owned = [...notes.values()].filter((note) => note.owner_id === owner_id);
  return ok(sortMkNotes(filterMkNotes(owned, query ?? {})));
}

async function findNote(
  notes: Map<string, MkNote>,
  id: string,
  owner_id: string,
): Promise<Result<MkNote | undefined, MkRepositoryError>> {
  const note = notes.get(id);
  return ok(note !== undefined && note.owner_id === owner_id ? note : undefined);
}

async function insertNote(notes: Map<string, MkNote>, note: MkNote): Promise<Result<MkNote, MkRepositoryError>> {
  notes.set(note.id, note);
  return ok(note);
}

async function updateNote(notes: Map<string, MkNote>, note: MkNote): Promise<Result<MkNote, MkRepositoryError>> {
  const current = notes.get(note.id);
  if (current === undefined || current.owner_id !== note.owner_id) return err({ code: "NOT_FOUND" });
  notes.set(note.id, note);
  return ok(note);
}

async function removeNote(
  notes: Map<string, MkNote>,
  id: string,
  owner_id: string,
): Promise<Result<null, MkRepositoryError>> {
  const current = notes.get(id);
  if (current === undefined || current.owner_id !== owner_id) return err({ code: "NOT_FOUND" });
  notes.delete(id);
  return ok(null);
}

function selectedNotes(notes: Map<string, MkNote>, ids: readonly string[], owner_id: string): MkNote[] | null {
  const selected: MkNote[] = [];
  for (const id of ids) {
    const note = notes.get(id);
    if (note === undefined || note.owner_id !== owner_id) return null;
    selected.push(note);
  }
  return selected;
}

async function bulkChange(
  notes: Map<string, MkNote>,
  ids: readonly string[],
  owner_id: string,
  change: BulkChange,
): Promise<Result<MkNote[], MkRepositoryError>> {
  const selected = selectedNotes(notes, ids, owner_id);
  if (selected === null) return err({ code: "NOT_FOUND" });
  const updated_at = new Date().toISOString();
  const changed = selected.map((note) =>
    change.kind === "color" ? changeMkNoteColor(note, change.color, updated_at) : changeMkNotePinned(note, change.pinned, updated_at),
  );
  changed.forEach((note) => notes.set(note.id, note));
  return ok(changed);
}

async function bulkRemove(
  notes: Map<string, MkNote>,
  ids: readonly string[],
  owner_id: string,
): Promise<Result<null, MkRepositoryError>> {
  const selected = selectedNotes(notes, ids, owner_id);
  if (selected === null) return err({ code: "NOT_FOUND" });
  selected.forEach((note) => notes.delete(note.id));
  return ok(null);
}
