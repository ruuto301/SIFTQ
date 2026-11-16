import {
  changeIdeaNoteColor,
  changeIdeaNotePinned,
  filterIdeaNotes,
  isArchived,
  isDeleted,
  setNoteArchived,
  setNoteDeleted,
  sortIdeaNotesByQuery,
} from "../idea";
import type { IdeaColor, IdeaNoteCounts, IdeaImage, IdeaNote, IdeaNoteQuery } from "../idea";
import { err, ok } from "../task";
import type { Result } from "../task";
import type { IdeaRepository, IdeaRepositoryError } from "../repository/idea-repository";

export function createMemoryIdeaRepository(
  initialNotes: readonly IdeaNote[] = [],
  initialImages: readonly IdeaImage[] = []
): IdeaRepository {
  const notes = new Map(initialNotes.map((note) => [note.id, note]));
  const images = new Map(initialImages.map((image) => [image.id, image]));

  return {
    list: (owner_id, query) => listNotes(notes, owner_id, query),
    counts: (owner_id) => countNotes(notes, owner_id),
    find: (id, owner_id) => findNote(notes, id, owner_id),
    insert: (note) => insertNote(notes, note),
    update: (note) => updateNote(notes, note),
    remove: (id, owner_id) => removeNotes(notes, images, [id], owner_id, false),
    bulkUpdateColor: (ids, owner_id, color) => bulkChange(notes, ids, owner_id, { kind: "color", color }),
    bulkPin: (ids, owner_id, pinned) => bulkChange(notes, ids, owner_id, { kind: "pin", pinned }),
    bulkRemove: (ids, owner_id) => removeNotes(notes, images, ids, owner_id, false),
    bulkArchive: (ids, owner_id, archived) => bulkChange(notes, ids, owner_id, { kind: "archive", archived }),
    bulkTrash: (ids, owner_id, deleted) => bulkChange(notes, ids, owner_id, { kind: "trash", deleted }),
    purge: (ids, owner_id) => removeNotes(notes, images, ids, owner_id, true),
    listImages: (note_id, owner_id) => listImages(images, note_id, owner_id),
    insertImage: (link) => insertImage(images, link),
    removeImage: (id, owner_id) => removeImage(images, id, owner_id),
    countImages: (note_id, owner_id) => countImages(images, note_id, owner_id),
  };
}



function ownedNotes(notes: Map<string, IdeaNote>, owner_id: string): IdeaNote[] {
  return [...notes.values()].filter((note) => note.owner_id === owner_id);
}

function toIdeaNoteCounts(owned: readonly IdeaNote[]): IdeaNoteCounts {
  const active = owned.filter((note) => !isDeleted(note) && !isArchived(note));
  return {
    notes: active.length,
    pinned: active.filter((note) => note.pinned).length,
    unpinned: active.filter((note) => !note.pinned).length,
    archived: owned.filter((note) => !isDeleted(note) && isArchived(note)).length,
    trash: owned.filter(isDeleted).length,
  };
}

async function listNotes(
  notes: Map<string, IdeaNote>,
  owner_id: string,
  query: IdeaNoteQuery | undefined,
): Promise<Result<IdeaNote[], IdeaRepositoryError>> {
  const owned = ownedNotes(notes, owner_id);
  return ok(sortIdeaNotesByQuery(filterIdeaNotes(owned, query ?? {}), query?.sort));
}

async function countNotes(
  notes: Map<string, IdeaNote>,
  owner_id: string,
): Promise<Result<IdeaNoteCounts, IdeaRepositoryError>> {
  return ok(toIdeaNoteCounts(ownedNotes(notes, owner_id)));
}

async function findNote(
  notes: Map<string, IdeaNote>,
  id: string,
  owner_id: string,
): Promise<Result<IdeaNote | undefined, IdeaRepositoryError>> {
  const note = notes.get(id);
  return ok(note !== undefined && note.owner_id === owner_id ? note : undefined);
}

async function insertNote(notes: Map<string, IdeaNote>, note: IdeaNote): Promise<Result<IdeaNote, IdeaRepositoryError>> {
  notes.set(note.id, note);
  return ok(note);
}

async function updateNote(notes: Map<string, IdeaNote>, note: IdeaNote): Promise<Result<IdeaNote, IdeaRepositoryError>> {
  const current = notes.get(note.id);
  if (current === undefined || current.owner_id !== note.owner_id) return err({ code: "NOT_FOUND" });
  notes.set(note.id, note);
  return ok(note);
}

function selectedNotes(notes: Map<string, IdeaNote>, ids: readonly string[], owner_id: string): IdeaNote[] | null {
  const selected: IdeaNote[] = [];
  for (const id of ids) {
    const note = notes.get(id);
    if (note === undefined || note.owner_id !== owner_id) return null;
    selected.push(note);
  }
  return selected;
}

type BulkChange =
  | { kind: "color"; color: IdeaColor }
  | { kind: "pin"; pinned: boolean }
  | { kind: "archive"; archived: boolean }
  | { kind: "trash"; deleted: boolean };

function applyBulkChange(note: IdeaNote, change: BulkChange, updated_at: string): IdeaNote {
  if (change.kind === "color") return changeIdeaNoteColor(note, change.color, updated_at);
  if (change.kind === "pin") return changeIdeaNotePinned(note, change.pinned, updated_at);
  if (change.kind === "archive") return setNoteArchived(note, change.archived, updated_at);
  return setNoteDeleted(note, change.deleted, updated_at);
}

async function bulkChange(
  notes: Map<string, IdeaNote>,
  ids: readonly string[],
  owner_id: string,
  change: BulkChange,
): Promise<Result<IdeaNote[], IdeaRepositoryError>> {
  const selected = selectedNotes(notes, ids, owner_id);
  if (selected === null) return err({ code: "NOT_FOUND" });
  const updated_at = new Date().toISOString();
  const changed = selected.map((note) => applyBulkChange(note, change, updated_at));
  changed.forEach((note) => notes.set(note.id, note));
  return ok(changed);
}

function dropNoteLinks(images: Map<string, IdeaImage>, selected: readonly IdeaNote[]): void {
  for (const note of selected) {
    for (const image of images.values()) {
      if (image.note_id === note.id) images.delete(image.id);
    }
  }
}

async function removeNotes(
  notes: Map<string, IdeaNote>,
  images: Map<string, IdeaImage>,
  ids: readonly string[],
  owner_id: string,
  requireTrashed: boolean,
): Promise<Result<null, IdeaRepositoryError>> {
  const selected = selectedNotes(notes, ids, owner_id);
  if (selected === null) return err({ code: "NOT_FOUND" });
  if (requireTrashed && selected.some((note) => !isDeleted(note))) return err({ code: "INVALID_STATE" });
  dropNoteLinks(images, selected);
  selected.forEach((note) => notes.delete(note.id));
  return ok(null);
}

function ownedImages(images: Map<string, IdeaImage>, note_id: string, owner_id: string): IdeaImage[] {
  return [...images.values()]
    .filter((image) => image.note_id === note_id && image.owner_id === owner_id)
    .sort((left, right) => left.position - right.position || left.id.localeCompare(right.id));
}

async function listImages(
  images: Map<string, IdeaImage>,
  note_id: string,
  owner_id: string,
): Promise<Result<IdeaImage[], IdeaRepositoryError>> {
  return ok(ownedImages(images, note_id, owner_id));
}

async function insertImage(
  images: Map<string, IdeaImage>,
  link: IdeaImage,
): Promise<Result<IdeaImage, IdeaRepositoryError>> {
  images.set(link.id, link);
  return ok(link);
}

async function removeImage(
  images: Map<string, IdeaImage>,
  id: string,
  owner_id: string,
): Promise<Result<null, IdeaRepositoryError>> {
  const image = images.get(id);
  if (image === undefined || image.owner_id !== owner_id) return err({ code: "NOT_FOUND" });
  images.delete(id);
  return ok(null);
}

async function countImages(
  images: Map<string, IdeaImage>,
  note_id: string,
  owner_id: string,
): Promise<Result<number, IdeaRepositoryError>> {
  return ok(ownedImages(images, note_id, owner_id).length);
}








