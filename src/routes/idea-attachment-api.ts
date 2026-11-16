import type { Context, Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import {
  IDEA_ATTACHMENT_MAX_COUNT,
  IDEA_ATTACHMENT_MAX_TOTAL_BYTES,
  attachmentContentDisposition,
  buildIdeaAttachmentKey,
  createIdeaAttachment,
  ideaAttachmentKind,
  ideaAttachmentLimitBytes,
  inlineContentDisposition,
  isIdeaAttachmentContentType,
  isIdeaAttachmentPreview,
  matchesIdeaAttachmentMagic,
  nextIdeaAttachmentPosition,
} from "../idea-attachment";
import type { IdeaAttachment } from "../idea-attachment";
import { isIdeaRecord } from "../idea";
import { err, ok } from "../task";
import type { Result } from "../task";
import { errorStatus, findOwned, problem, readJsonRecord, respondRemoved } from "./api-helpers";
import type { AppEnv } from "../app-env";
import type { IdeaRepository } from "../repository/idea-repository";

const OWNER_ID = "local";
/** HTML を同一オリジンの生ページとして開かせないための応答ヘッダ。 */
const HTML_SANDBOX_CSP = "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:";

/** R2 のうち添付が使う最小面。テストでは同じ形のメモリ実装を渡す。 */
export type IdeaAttachmentObject = { arrayBuffer: () => Promise<ArrayBuffer> };
export type IdeaAttachmentBucket = {
  put: (key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType?: string } }) => Promise<unknown>;
  get: (key: string) => Promise<IdeaAttachmentObject | null>;
  delete: (key: string) => Promise<unknown>;
};

type IdeaRepositoryFactory = (c: Context<AppEnv>) => IdeaRepository;
type IdeaAttachmentBucketFactory = (c: Context<AppEnv>) => IdeaAttachmentBucket | null;

type AttachmentSummary = {
  id: string;
  name: string;
  content_type: string;
  bytes: number;
  kind: string;
  preview: string;
  created_at: string;
  url: string;
};

function attachmentSummary(attachment: IdeaAttachment): AttachmentSummary {
  return {
    id: attachment.id,
    name: attachment.name,
    content_type: attachment.content_type,
    bytes: attachment.bytes,
    kind: attachment.kind,
    preview: attachment.preview,
    created_at: attachment.created_at,
    url: `/api/attachments/${attachment.id}`,
  };
}

/** ファイル名はパス区切りを落とし、空なら既定名を使う。 */
function attachmentName(file: File): string {
  const name = file.name.replace(/[\\/]/g, "_").replace(/[\r\n]/g, "").trim();
  return name === "" ? "attachment" : name.slice(0, 200);
}

async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** テキスト系は文字コードを明示しないとブラウザが勝手に解釈する。 */
function attachmentContentType(contentType: string): string {
  const textual =
    contentType.startsWith("text/") || contentType === "application/json" || contentType === "image/svg+xml";
  return textual ? `${contentType}; charset=utf-8` : contentType;
}

function attachmentHeaders(attachment: IdeaAttachment, download: boolean): Record<string, string> {
  const html = attachment.content_type === "text/html";
  const inlineType =
    attachment.kind === "image" || attachment.content_type === "image/svg+xml" || html;
  const inline = !download && attachment.preview !== "download" && inlineType;
  const headers: Record<string, string> = {
    "content-type": attachmentContentType(attachment.content_type),
    "cache-control": "private, max-age=31536000, immutable",
    "x-content-type-options": "nosniff",
    "content-disposition": inline ? inlineContentDisposition() : attachmentContentDisposition(attachment.name),
  };
  if (inline && html) headers["content-security-policy"] = HTML_SANDBOX_CSP;
  return headers;
}

type AttachmentUpload = { contentType: string; name: string; buffer: ArrayBuffer };
type UploadFailure = { code: string; status: ContentfulStatusCode };

/** multipart の `file` を読み、許可リスト・サイズ・マジックバイトまで検証する。 */
async function readAttachmentUpload(c: Context<AppEnv>): Promise<Result<AttachmentUpload, UploadFailure>> {
  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return err({ code: "INVALID_ATTACHMENT", status: 400 });
  }
  const file = form.get("file");
  if (file === null || typeof file === "string") return err({ code: "INVALID_ATTACHMENT", status: 400 });
  const contentType = file.type.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!isIdeaAttachmentContentType(contentType)) return err({ code: "UNSUPPORTED_ATTACHMENT", status: 400 });
  const buffer = await file.arrayBuffer();
  const data = new Uint8Array(buffer);
  if (data.byteLength === 0) return err({ code: "INVALID_ATTACHMENT", status: 400 });
  if (data.byteLength > ideaAttachmentLimitBytes(contentType)) return err({ code: "ATTACHMENT_TOO_LARGE", status: 413 });
  if (!matchesIdeaAttachmentMagic(contentType, data)) return err({ code: "UNSUPPORTED_ATTACHMENT", status: 400 });
  return ok({ contentType, name: attachmentName(file), buffer });
}

/** メモあたりの件数と合計サイズを確認し、既存の並びを返す。 */
async function reserveAttachmentSlot(
  repository: IdeaRepository,
  noteId: string,
  bytes: number,
): Promise<Result<IdeaAttachment[], UploadFailure>> {
  const count = await repository.countAttachments(noteId, OWNER_ID);
  if (!count.ok) return err({ code: count.error.code, status: 500 });
  if (count.value >= IDEA_ATTACHMENT_MAX_COUNT) return err({ code: "ATTACHMENT_LIMIT_EXCEEDED", status: 400 });
  const attached = await repository.listAttachments(noteId, OWNER_ID);
  if (!attached.ok) return err({ code: attached.error.code, status: 500 });
  const total = attached.value.reduce((sum, item) => sum + item.bytes, 0);
  if (total + bytes > IDEA_ATTACHMENT_MAX_TOTAL_BYTES) {
    return err({ code: "ATTACHMENT_TOTAL_EXCEEDED", status: 400 });
  }
  return ok(attached.value);
}

type NoteTarget = { ok: true; repository: IdeaRepository; noteId: string } | { ok: false; response: Response };

/** パスの note id を所有確認し、リポジトリと一緒に返す。 */
async function noteTarget(c: Context<AppEnv>, ideaRepository: IdeaRepositoryFactory): Promise<NoteTarget> {
  const noteId = c.req.param("id");
  if (noteId === undefined) return { ok: false, response: problem(c, 404, "NOT_FOUND") };
  const repository = ideaRepository(c);
  const note = await repository.find(noteId, OWNER_ID);
  if (!note.ok || note.value === undefined) return { ok: false, response: problem(c, 404, "NOT_FOUND") };
  return { ok: true, repository, noteId };
}

async function uploadAttachment(
  c: Context<AppEnv>,
  ideaRepository: IdeaRepositoryFactory,
  bucket: IdeaAttachmentBucketFactory,
) {
  const store = bucket(c);
  if (store === null) return problem(c, 503, "ATTACHMENTS_UNAVAILABLE");
  const target = await noteTarget(c, ideaRepository);
  if (!target.ok) return target.response;

  const upload = await readAttachmentUpload(c);
  if (!upload.ok) return problem(c, upload.error.status, upload.error.code);
  const slot = await reserveAttachmentSlot(target.repository, target.noteId, upload.value.buffer.byteLength);
  if (!slot.ok) return problem(c, slot.error.status, slot.error.code);

  const createdAt = new Date().toISOString();
  const id = crypto.randomUUID();
  const key = buildIdeaAttachmentKey(OWNER_ID, createdAt, id);
  if (key === null) return problem(c, 400, "INVALID_ATTACHMENT");
  const created = createIdeaAttachment({
    id,
    owner_id: OWNER_ID,
    note_id: target.noteId,
    position: nextIdeaAttachmentPosition(slot.value),
    kind: ideaAttachmentKind(upload.value.contentType),
    name: upload.value.name,
    content_type: upload.value.contentType,
    bytes: upload.value.buffer.byteLength,
    r2_key: key,
    sha256: await sha256Hex(upload.value.buffer),
    created_at: createdAt,
  });
  if (!created.ok) return problem(c, 400, created.error.code);

  await store.put(key, upload.value.buffer, { httpMetadata: { contentType: upload.value.contentType } });
  const inserted = await target.repository.insertAttachment(created.value);
  if (!inserted.ok) return problem(c, 500, inserted.error.code);
  return c.json(attachmentSummary(inserted.value), 201);
}

async function listNoteAttachments(c: Context<AppEnv>, ideaRepository: IdeaRepositoryFactory) {
  const target = await noteTarget(c, ideaRepository);
  if (!target.ok) return target.response;
  const attached = await target.repository.listAttachments(target.noteId, OWNER_ID);
  if (!attached.ok) return problem(c, 500, attached.error.code);
  return c.json(attached.value.map(attachmentSummary));
}

async function patchAttachmentPreview(c: Context<AppEnv>, ideaRepository: IdeaRepositoryFactory) {
  const id = c.req.param("id");
  if (id === undefined) return problem(c, 404, "NOT_FOUND");
  const body = await readJsonRecord(c, isIdeaRecord);
  if (body === null) return problem(c, 400, "INVALID_INPUT");
  const preview = body["preview"];
  if (!isIdeaAttachmentPreview(preview)) return problem(c, 400, "INVALID_PREVIEW");
  const repository = ideaRepository(c);
  const updated = await repository.updateAttachmentPreview(id, OWNER_ID, preview);
  if (!updated.ok) return problem(c, errorStatus(updated.error.code), updated.error.code);
  const found = await repository.findAttachment(id, OWNER_ID);
  if (!found.ok) return problem(c, 500, found.error.code);
  if (found.value === undefined) return problem(c, 404, "NOT_FOUND");
  return c.json(attachmentSummary(found.value));
}

async function deleteAttachment(c: Context<AppEnv>, ideaRepository: IdeaRepositoryFactory) {
  const id = c.req.param("id");
  if (id === undefined) return problem(c, 404, "NOT_FOUND");
  return respondRemoved(c, ideaRepository(c).removeAttachment(id, OWNER_ID));
}

async function serveAttachment(
  c: Context<AppEnv>,
  ideaRepository: IdeaRepositoryFactory,
  bucket: IdeaAttachmentBucketFactory,
) {
  const id = c.req.param("id");
  if (id === undefined) return problem(c, 404, "NOT_FOUND");
  const store = bucket(c);
  if (store === null) return problem(c, 503, "ATTACHMENTS_UNAVAILABLE");
  const found = await findOwned(ideaRepository(c).findAttachment(id, OWNER_ID), { code: "NOT_FOUND" });
  if (!found.ok) return problem(c, errorStatus(found.error.code), found.error.code);
  const object = await store.get(found.value.r2_key);
  if (object === null) return problem(c, 404, "NOT_FOUND");
  const body = await object.arrayBuffer();
  return c.body(body, 200, attachmentHeaders(found.value, c.req.query("download") === "1"));
}

export function registerIdeaAttachmentApiRoutes(
  app: Hono<AppEnv>,
  ideaRepository: IdeaRepositoryFactory,
  bucket: IdeaAttachmentBucketFactory,
) {
  app.post("/api/ideas/notes/:id/attachments", (c) => uploadAttachment(c, ideaRepository, bucket));
  app.get("/api/ideas/notes/:id/attachments", (c) => listNoteAttachments(c, ideaRepository));
  app.patch("/api/ideas/attachments/:id", (c) => patchAttachmentPreview(c, ideaRepository));
  app.delete("/api/ideas/attachments/:id", (c) => deleteAttachment(c, ideaRepository));
  app.get("/api/attachments/:id", (c) => serveAttachment(c, ideaRepository, bucket));
}
