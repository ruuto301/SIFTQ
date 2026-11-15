import type { MkColor, MkCounts, MkError, MkImage, MkLabel, MkNote, MkNoteLabelMap, MkNoteQuery } from "../mk";
import type { Result } from "../task";

export type MkRepositoryError = MkError;

export interface MkRepository {
  list(owner_id: string, query?: MkNoteQuery): Promise<Result<MkNote[], MkRepositoryError>>;
  counts(owner_id: string): Promise<Result<MkCounts, MkRepositoryError>>;
  find(id: string, owner_id: string): Promise<Result<MkNote | undefined, MkRepositoryError>>;
  insert(note: MkNote): Promise<Result<MkNote, MkRepositoryError>>;
  update(note: MkNote): Promise<Result<MkNote, MkRepositoryError>>;
  remove(id: string, owner_id: string): Promise<Result<null, MkRepositoryError>>;
  bulkUpdateColor(
    ids: readonly string[],
    owner_id: string,
    color: MkColor,
  ): Promise<Result<MkNote[], MkRepositoryError>>;
  bulkPin(ids: readonly string[], owner_id: string, pinned: boolean): Promise<Result<MkNote[], MkRepositoryError>>;
  bulkRemove(ids: readonly string[], owner_id: string): Promise<Result<null, MkRepositoryError>>;
  bulkArchive(
    ids: readonly string[],
    owner_id: string,
    archived: boolean,
  ): Promise<Result<MkNote[], MkRepositoryError>>;
  bulkTrash(ids: readonly string[], owner_id: string, deleted: boolean): Promise<Result<MkNote[], MkRepositoryError>>;
  purge(ids: readonly string[], owner_id: string): Promise<Result<null, MkRepositoryError>>;
  listImages(note_id: string, owner_id: string): Promise<Result<MkImage[], MkRepositoryError>>;
  insertImage(link: MkImage): Promise<Result<MkImage, MkRepositoryError>>;
  removeImage(id: string, owner_id: string): Promise<Result<null, MkRepositoryError>>;
  countImages(note_id: string, owner_id: string): Promise<Result<number, MkRepositoryError>>;
  listLabels(owner_id: string): Promise<Result<MkLabel[], MkRepositoryError>>;
  createLabel(label: MkLabel): Promise<Result<MkLabel, MkRepositoryError>>;
  renameLabel(id: string, owner_id: string, name: string): Promise<Result<MkLabel, MkRepositoryError>>;
  deleteLabel(id: string, owner_id: string): Promise<Result<null, MkRepositoryError>>;
  setNoteLabels(
    note_id: string,
    owner_id: string,
    label_ids: readonly string[],
  ): Promise<Result<MkLabel[], MkRepositoryError>>;
  listLabelsForNotes(
    note_ids: readonly string[],
    owner_id: string,
  ): Promise<Result<MkNoteLabelMap, MkRepositoryError>>;
}
