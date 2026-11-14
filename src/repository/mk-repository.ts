import type { MkColor, MkError, MkNote, MkNoteQuery } from "../mk";
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
}
