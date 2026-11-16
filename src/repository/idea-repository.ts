import type { IdeaColor, IdeaNoteCounts, IdeaError, IdeaImage, IdeaNote, IdeaNoteQuery } from "../idea";
import type { IdeaAttachment, IdeaAttachmentPreview } from "../idea-attachment";
import type { Result } from "../task";

export type IdeaRepositoryError = IdeaError;

export interface IdeaRepository {
  list(owner_id: string, query?: IdeaNoteQuery): Promise<Result<IdeaNote[], IdeaRepositoryError>>;
  counts(owner_id: string): Promise<Result<IdeaNoteCounts, IdeaRepositoryError>>;
  find(id: string, owner_id: string): Promise<Result<IdeaNote | undefined, IdeaRepositoryError>>;
  insert(note: IdeaNote): Promise<Result<IdeaNote, IdeaRepositoryError>>;
  update(note: IdeaNote): Promise<Result<IdeaNote, IdeaRepositoryError>>;
  remove(id: string, owner_id: string): Promise<Result<null, IdeaRepositoryError>>;
  bulkUpdateColor(
    ids: readonly string[],
    owner_id: string,
    color: IdeaColor,
  ): Promise<Result<IdeaNote[], IdeaRepositoryError>>;
  bulkPin(ids: readonly string[], owner_id: string, pinned: boolean): Promise<Result<IdeaNote[], IdeaRepositoryError>>;
  bulkRemove(ids: readonly string[], owner_id: string): Promise<Result<null, IdeaRepositoryError>>;
  bulkArchive(
    ids: readonly string[],
    owner_id: string,
    archived: boolean,
  ): Promise<Result<IdeaNote[], IdeaRepositoryError>>;
  bulkTrash(ids: readonly string[], owner_id: string, deleted: boolean): Promise<Result<IdeaNote[], IdeaRepositoryError>>;
  purge(ids: readonly string[], owner_id: string): Promise<Result<null, IdeaRepositoryError>>;
  listImages(note_id: string, owner_id: string): Promise<Result<IdeaImage[], IdeaRepositoryError>>;
  insertImage(link: IdeaImage): Promise<Result<IdeaImage, IdeaRepositoryError>>;
  removeImage(id: string, owner_id: string): Promise<Result<null, IdeaRepositoryError>>;
  countImages(note_id: string, owner_id: string): Promise<Result<number, IdeaRepositoryError>>;
  listAttachments(note_id: string, owner_id: string): Promise<Result<IdeaAttachment[], IdeaRepositoryError>>;
  insertAttachment(attachment: IdeaAttachment): Promise<Result<IdeaAttachment, IdeaRepositoryError>>;
  removeAttachment(id: string, owner_id: string): Promise<Result<null, IdeaRepositoryError>>;
  countAttachments(note_id: string, owner_id: string): Promise<Result<number, IdeaRepositoryError>>;
  findAttachment(id: string, owner_id: string): Promise<Result<IdeaAttachment | undefined, IdeaRepositoryError>>;
  updateAttachmentPreview(
    id: string,
    owner_id: string,
    preview: IdeaAttachmentPreview,
  ): Promise<Result<null, IdeaRepositoryError>>;
}
