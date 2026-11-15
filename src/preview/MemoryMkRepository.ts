import {
  changeMkNoteColor,
  changeMkNotePinned,
  filterMkNotes,
  isArchived,
  isDeleted,
  isMkLabelNameTaken,
  setNoteArchived,
  setNoteDeleted,
  sortMkNotes,
} from "../mk";
import type { MkColor, MkCounts, MkImage, MkLabel, MkNote, MkNoteCounts, MkNoteLabel, MkNoteLabelMap, MkNoteQuery } from "../mk";
import { err, ok } from "../task";
import type { Result } from "../task";
import type { MkRepository, MkRepositoryError } from "../repository/mk-repository";

export function createMemoryMkRepository(
  initialNotes: readonly MkNote[] = [],
  initialImages: readonly MkImage[] = [],
  initialLabels: readonly MkLabel[] = [],
  initialNoteLabels: readonly MkNoteLabel[] = [],
): MkRepository {
  const notes = new Map(initialNotes.map((note) => [note.id, note]));
  const images = new Map(initialImages.map((image) => [image.id, image]));
  const labels = new Map(initialLabels.map((label) => [label.id, label]));
  const links = new Map(initialNoteLabels.map((link) => [linkKey(link.note_id, link.label_id), link]));

  return {
    list: (owner_id, query) => listNotes(notes, links, owner_id, query),
    counts: (owner_id) => countNotes(notes, links, labels, owner_id),
    find: (id, owner_id) => findNote(notes, id, owner_id),
    insert: (note) => insertNote(notes, note),
    update: (note) => updateNote(notes, note),
    remove: (id, owner_id) => removeNotes(notes, images, links, [id], owner_id, false),
    bulkUpdateColor: (ids, owner_id, color) => bulkChange(notes, ids, owner_id, { kind: "color", color }),
    bulkPin: (ids, owner_id, pinned) => bulkChange(notes, ids, owner_id, { kind: "pin", pinned }),
    bulkRemove: (ids, owner_id) => removeNotes(notes, images, links, ids, owner_id, false),
    bulkArchive: (ids, owner_id, archived) => bulkChange(notes, ids, owner_id, { kind: "archive", archived }),
    bulkTrash: (ids, owner_id, deleted) => bulkChange(notes, ids, owner_id, { kind: "trash", deleted }),
    purge: (ids, owner_id) => removeNotes(notes, images, links, ids, owner_id, true),
    listImages: (note_id, owner_id) => listImages(images, note_id, owner_id),
    insertImage: (link) => insertImage(images, link),
    removeImage: (id, owner_id) => removeImage(images, id, owner_id),
    countImages: (note_id, owner_id) => countImages(images, note_id, owner_id),
    listLabels: (owner_id) => listLabels(labels, owner_id),
    createLabel: (label) => createLabel(labels, label),
    renameLabel: (id, owner_id, name) => renameLabel(labels, id, owner_id, name),
    deleteLabel: (id, owner_id) => deleteLabel(labels, links, id, owner_id),
    setNoteLabels: (note_id, owner_id, label_ids) => setNoteLabels(notes, labels, links, note_id, owner_id, label_ids),
    listLabelsForNotes: (note_ids, owner_id) => listLabelsForNotes(labels, links, note_ids, owner_id),
  };
}

function linkKey(note_id: string, label_id: string): string {
  return `${note_id}:${label_id}`;
}

function hasNoteLabel(links: Map<string, MkNoteLabel>, note_id: string, label_id: string, owner_id: string): boolean {
  return links.get(linkKey(note_id, label_id))?.owner_id === owner_id;
}

function ownedNotes(notes: Map<string, MkNote>, owner_id: string): MkNote[] {
  return [...notes.values()].filter((note) => note.owner_id === owner_id);
}

function toMkNoteCounts(owned: readonly MkNote[]): MkNoteCounts {
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
  notes: Map<string, MkNote>,
  links: Map<string, MkNoteLabel>,
  owner_id: string,
  query: MkNoteQuery | undefined,
): Promise<Result<MkNote[], MkRepositoryError>> {
  const owned = ownedNotes(notes, owner_id);
  const labelId = query?.labelId;
  const matching = labelId === undefined ? owned : owned.filter((note) => hasNoteLabel(links, note.id, labelId, owner_id));
  return ok(sortMkNotes(filterMkNotes(matching, query ?? {})));
}

async function countNotes(
  notes: Map<string, MkNote>,
  links: Map<string, MkNoteLabel>,
  labels: Map<string, MkLabel>,
  owner_id: string,
): Promise<Result<MkCounts, MkRepositoryError>> {
  const owned = ownedNotes(notes, owner_id);
  const active = owned.filter((note) => !isDeleted(note) && !isArchived(note));
  const labelCounts: Record<string, number> = {};
  for (const label of labels.values()) {
    if (label.owner_id !== owner_id) continue;
    labelCounts[label.id] = active.filter((note) => hasNoteLabel(links, note.id, label.id, owner_id)).length;
  }
  return ok({ ...toMkNoteCounts(owned), labels: labelCounts });
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

function selectedNotes(notes: Map<string, MkNote>, ids: readonly string[], owner_id: string): MkNote[] | null {
  const selected: MkNote[] = [];
  for (const id of ids) {
    const note = notes.get(id);
    if (note === undefined || note.owner_id !== owner_id) return null;
    selected.push(note);
  }
  return selected;
}

type BulkChange =
  | { kind: "color"; color: MkColor }
  | { kind: "pin"; pinned: boolean }
  | { kind: "archive"; archived: boolean }
  | { kind: "trash"; deleted: boolean };

function applyBulkChange(note: MkNote, change: BulkChange, updated_at: string): MkNote {
  if (change.kind === "color") return changeMkNoteColor(note, change.color, updated_at);
  if (change.kind === "pin") return changeMkNotePinned(note, change.pinned, updated_at);
  if (change.kind === "archive") return setNoteArchived(note, change.archived, updated_at);
  return setNoteDeleted(note, change.deleted, updated_at);
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
  const changed = selected.map((note) => applyBulkChange(note, change, updated_at));
  changed.forEach((note) => notes.set(note.id, note));
  return ok(changed);
}

function dropNoteLinks(
  images: Map<string, MkImage>,
  links: Map<string, MkNoteLabel>,
  selected: readonly MkNote[],
): void {
  for (const note of selected) {
    for (const image of images.values()) {
      if (image.note_id === note.id) images.delete(image.id);
    }
    for (const link of links.values()) {
      if (link.note_id === note.id) links.delete(linkKey(link.note_id, link.label_id));
    }
  }
}

async function removeNotes(
  notes: Map<string, MkNote>,
  images: Map<string, MkImage>,
  links: Map<string, MkNoteLabel>,
  ids: readonly string[],
  owner_id: string,
  requireTrashed: boolean,
): Promise<Result<null, MkRepositoryError>> {
  const selected = selectedNotes(notes, ids, owner_id);
  if (selected === null) return err({ code: "NOT_FOUND" });
  if (requireTrashed && selected.some((note) => !isDeleted(note))) return err({ code: "INVALID_STATE" });
  dropNoteLinks(images, links, selected);
  selected.forEach((note) => notes.delete(note.id));
  return ok(null);
}

function ownedImages(images: Map<string, MkImage>, note_id: string, owner_id: string): MkImage[] {
  return [...images.values()]
    .filter((image) => image.note_id === note_id && image.owner_id === owner_id)
    .sort((left, right) => left.position - right.position || left.id.localeCompare(right.id));
}

async function listImages(
  images: Map<string, MkImage>,
  note_id: string,
  owner_id: string,
): Promise<Result<MkImage[], MkRepositoryError>> {
  return ok(ownedImages(images, note_id, owner_id));
}

async function insertImage(
  images: Map<string, MkImage>,
  link: MkImage,
): Promise<Result<MkImage, MkRepositoryError>> {
  images.set(link.id, link);
  return ok(link);
}

async function removeImage(
  images: Map<string, MkImage>,
  id: string,
  owner_id: string,
): Promise<Result<null, MkRepositoryError>> {
  const image = images.get(id);
  if (image === undefined || image.owner_id !== owner_id) return err({ code: "NOT_FOUND" });
  images.delete(id);
  return ok(null);
}

async function countImages(
  images: Map<string, MkImage>,
  note_id: string,
  owner_id: string,
): Promise<Result<number, MkRepositoryError>> {
  return ok(ownedImages(images, note_id, owner_id).length);
}

function sortedLabels(labels: readonly MkLabel[]): MkLabel[] {
  return [...labels].sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
}

async function listLabels(labels: Map<string, MkLabel>, owner_id: string): Promise<Result<MkLabel[], MkRepositoryError>> {
  return ok(sortedLabels([...labels.values()].filter((label) => label.owner_id === owner_id)));
}

async function createLabel(labels: Map<string, MkLabel>, label: MkLabel): Promise<Result<MkLabel, MkRepositoryError>> {
  if (isMkLabelNameTaken(await listOwnedLabels(labels, label.owner_id), label.name)) return err({ code: "CONFLICT" });
  labels.set(label.id, label);
  return ok(label);
}

async function listOwnedLabels(labels: Map<string, MkLabel>, owner_id: string): Promise<MkLabel[]> {
  return [...labels.values()].filter((label) => label.owner_id === owner_id);
}

async function renameLabel(
  labels: Map<string, MkLabel>,
  id: string,
  owner_id: string,
  name: string,
): Promise<Result<MkLabel, MkRepositoryError>> {
  const current = labels.get(id);
  if (current === undefined || current.owner_id !== owner_id) return err({ code: "NOT_FOUND" });
  if (isMkLabelNameTaken(await listOwnedLabels(labels, owner_id), name, id)) return err({ code: "CONFLICT" });
  const renamed = { ...current, name };
  labels.set(id, renamed);
  return ok(renamed);
}

async function deleteLabel(
  labels: Map<string, MkLabel>,
  links: Map<string, MkNoteLabel>,
  id: string,
  owner_id: string,
): Promise<Result<null, MkRepositoryError>> {
  const current = labels.get(id);
  if (current === undefined || current.owner_id !== owner_id) return err({ code: "NOT_FOUND" });
  for (const link of links.values()) {
    if (link.label_id === id) links.delete(linkKey(link.note_id, link.label_id));
  }
  labels.delete(id);
  return ok(null);
}

async function setNoteLabels(
  notes: Map<string, MkNote>,
  labels: Map<string, MkLabel>,
  links: Map<string, MkNoteLabel>,
  note_id: string,
  owner_id: string,
  label_ids: readonly string[],
): Promise<Result<MkLabel[], MkRepositoryError>> {
  const note = notes.get(note_id);
  if (note === undefined || note.owner_id !== owner_id) return err({ code: "NOT_FOUND" });
  const selected = label_ids
    .map((label_id) => labels.get(label_id))
    .filter((label): label is MkLabel => label !== undefined && label.owner_id === owner_id);
  if (selected.length !== label_ids.length) return err({ code: "NOT_FOUND" });
  for (const link of links.values()) {
    if (link.note_id === note_id) links.delete(linkKey(link.note_id, link.label_id));
  }
  for (const label of selected) links.set(linkKey(note_id, label.id), { note_id, label_id: label.id, owner_id });
  return ok(sortedLabels(selected));
}

async function listLabelsForNotes(
  labels: Map<string, MkLabel>,
  links: Map<string, MkNoteLabel>,
  note_ids: readonly string[],
  owner_id: string,
): Promise<Result<MkNoteLabelMap, MkRepositoryError>> {
  const map: MkNoteLabelMap = {};
  for (const note_id of note_ids) {
    const attached = [...links.values()]
      .filter((link) => link.note_id === note_id && link.owner_id === owner_id)
      .map((link) => labels.get(link.label_id))
      .filter((label): label is MkLabel => label !== undefined && label.owner_id === owner_id);
    if (attached.length > 0) map[note_id] = sortedLabels(attached);
  }
  return ok(map);
}
