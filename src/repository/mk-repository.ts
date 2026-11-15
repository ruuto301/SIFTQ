import type { MkColor, MkError, MkImage, MkNote, MkNoteQuery } from "../mk";
import type { Result } from "../task";

export type MkRepositoryError = MkError;

export interface MkRepository {
  list(owner_id: string, query?: MkNoteQuery): Promise<Result<MkNote[], MkRepositoryError>>;
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
  listImages(note_id: string, owner_id: string): Promise<Result<MkImage[], MkRepositoryError>>;
  insertImage(link: MkImage): Promise<Result<MkImage, MkRepositoryError>>;
  removeImage(id: string, owner_id: string): Promise<Result<null, MkRepositoryError>>;
  countImages(note_id: string, owner_id: string): Promise<Result<number, MkRepositoryError>>;
}
