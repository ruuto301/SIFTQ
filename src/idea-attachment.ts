import { err, isRecord, ok } from "./task";
import type { Result } from "./task";
import type { IdeaError } from "./idea";

/** 画像は縮小前でも 5MB まで受け付ける（旧 D1 BLOB の 1MB 制限を撤廃）。 */
export const IDEA_ATTACHMENT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
/** 画像以外のファイル上限。 */
export const IDEA_ATTACHMENT_FILE_MAX_BYTES = 25 * 1024 * 1024;
export const IDEA_ATTACHMENT_MAX_COUNT = 10;
export const IDEA_ATTACHMENT_MAX_TOTAL_BYTES = 50 * 1024 * 1024;

export const IDEA_ATTACHMENT_KINDS = ["image", "file"] as const;
export type IdeaAttachmentKind = (typeof IDEA_ATTACHMENT_KINDS)[number];

/** 添付ごとの表示方法。HTML / SVG は危険側に倒せるようダウンロードのみも選べる。 */
export const IDEA_ATTACHMENT_PREVIEWS = ["inline", "source", "download"] as const;
export type IdeaAttachmentPreview = (typeof IDEA_ATTACHMENT_PREVIEWS)[number];

/**
 * 添付を許可する MIME の許可リスト。実行系や application/javascript は含めない。
 * `image/svg+xml` と `text/html` はサンドボックス化された表示だけを許可する。
 */
export const IDEA_ATTACHMENT_CONTENT_TYPES = [
  "image/png",
  "image/webp",
  "image/jpeg",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/zip",
  "text/html",
  "image/svg+xml",
] as const;

export type IdeaAttachmentContentType = (typeof IDEA_ATTACHMENT_CONTENT_TYPES)[number];

export type IdeaAttachment = {
  id: string;
  owner_id: string;
  note_id: string;
  position: number;
  kind: IdeaAttachmentKind;
  name: string;
  content_type: string;
  bytes: number;
  r2_key: string;
  sha256: string;
  preview: IdeaAttachmentPreview;
  created_at: string;
  deleted_at: string | null;
};

export type CreateIdeaAttachmentInput = Omit<IdeaAttachment, "deleted_at" | "preview"> & {
  preview?: IdeaAttachmentPreview;
};

export function isIdeaAttachmentContentType(value: string): value is IdeaAttachmentContentType {
  return IDEA_ATTACHMENT_CONTENT_TYPES.some((contentType) => contentType === value);
}

export function isIdeaAttachmentKind(value: unknown): value is IdeaAttachmentKind {
  return typeof value === "string" && IDEA_ATTACHMENT_KINDS.some((kind) => kind === value);
}

export function isIdeaAttachmentPreview(value: unknown): value is IdeaAttachmentPreview {
  return typeof value === "string" && IDEA_ATTACHMENT_PREVIEWS.some((preview) => preview === value);
}

/** 画像はサムネイル、それ以外はチップとして扱う。 */
export function ideaAttachmentKind(contentType: string): IdeaAttachmentKind {
  return contentType.startsWith("image/") ? "image" : "file";
}

export function ideaAttachmentLimitBytes(contentType: string): number {
  return ideaAttachmentKind(contentType) === "image" ? IDEA_ATTACHMENT_IMAGE_MAX_BYTES : IDEA_ATTACHMENT_FILE_MAX_BYTES;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value !== "";
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isNullableString(value: unknown): boolean {
  return value === null || isNonEmptyString(value);
}

export function isIdeaAttachment(value: unknown): value is IdeaAttachment {
  if (!isRecord(value)) return false;
  const record = value;
  return (
    isNonEmptyString(record["id"]) &&
    isNonEmptyString(record["owner_id"]) &&
    isNonEmptyString(record["note_id"]) &&
    isPositiveInteger(record["position"]) &&
    isIdeaAttachmentKind(record["kind"]) &&
    isNonEmptyString(record["name"]) &&
    isNonEmptyString(record["content_type"]) &&
    isNonNegativeInteger(record["bytes"]) &&
    isNonEmptyString(record["r2_key"]) &&
    isNonEmptyString(record["sha256"]) &&
    isIdeaAttachmentPreview(record["preview"]) &&
    isNonEmptyString(record["created_at"]) &&
    isNullableString(record["deleted_at"])
  );
}

export function createIdeaAttachment(input: CreateIdeaAttachmentInput): Result<IdeaAttachment, IdeaError> {
  const attachment: IdeaAttachment = { ...input, preview: input.preview ?? "inline", deleted_at: null };
  return isIdeaAttachment(attachment) ? ok(attachment) : err({ code: "INVALID_ATTACHMENT" });
}

const KEY_SEGMENT = /^[A-Za-z0-9_-]+$/;

/** 所有者・年月・uuid で衝突しない R2 キーを組み立てる。 */
export function buildIdeaAttachmentKey(ownerId: string, createdAt: string, id: string): string | null {
  if (!KEY_SEGMENT.test(ownerId) || !KEY_SEGMENT.test(id)) return null;
  const month = createdAt.slice(0, 7).replace("-", "");
  return /^\d{6}$/.test(month) ? `attachments/${ownerId}/${month}/${id}` : null;
}

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((value, index) => bytes[offset + index] === value);
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Content-Type と食い違う実行ファイルを弾くための最小限のシグネチャ判定。 */
export function sniffIdeaAttachmentContentType(bytes: Uint8Array): string | null {
  if (startsWith(bytes, PNG_SIGNATURE)) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return "image/gif";
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && ascii(bytes, 8, 4) === "WEBP") return "image/webp";
  if (ascii(bytes, 0, 5) === "%PDF-") return "application/pdf";
  if (ascii(bytes, 0, 2) === "PK" && [0x03, 0x05, 0x07].includes(bytes[2] ?? -1)) return "application/zip";
  if (startsWith(bytes, [0x7f, 0x45, 0x4c, 0x46])) return "application/x-elf";
  if (startsWith(bytes, [0x4d, 0x5a])) return "application/x-dosexec";
  return sniffIdeaAttachmentTextContentType(bytes);
}

function leadingText(bytes: Uint8Array, length: number): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, length)).trimStart().toLowerCase();
}

/** テキスト系は先頭の数バイトから HTML / SVG / JSON かどうかだけを見分ける。 */
function sniffIdeaAttachmentTextContentType(bytes: Uint8Array): string | null {
  if (bytes.includes(0x00)) return "application/octet-stream";
  const head = leadingText(bytes, 512);
  if (head.startsWith("<?xml") || head.startsWith("<svg")) return "image/svg+xml";
  if (head.startsWith("<!doctype html") || head.startsWith("<html")) return "text/html";
  if (head.startsWith("{") || head.startsWith("[")) return "application/json";
  return null;
}

function isTextualContentType(contentType: string): boolean {
  return contentType === "text/plain" || contentType === "text/markdown" || contentType === "text/csv";
}

/** バイナリと判明したシグネチャ。テキスト系にこれらが来たら拒否する。 */
const BINARY_SNIFFS = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/zip",
  "application/octet-stream",
  "application/x-elf",
  "application/x-dosexec",
]);

/**
 * 宣言された MIME と実際のバイト列が矛盾しないか検証する。
 * テキスト系は実行ファイルや画像が紛れ込んでいないことだけを確認する。
 */
export function matchesIdeaAttachmentMagic(contentType: string, bytes: Uint8Array): boolean {
  const sniffed = sniffIdeaAttachmentContentType(bytes);
  if (isTextualContentType(contentType)) return sniffed === null || !BINARY_SNIFFS.has(sniffed);
  if (contentType === "image/svg+xml") return sniffed === "image/svg+xml";
  if (contentType === "text/html") return sniffed === "text/html";
  if (contentType === "application/json") return sniffed === "application/json";
  return sniffed === contentType;
}

/** RFC 5987 の filename* 用に、attr-char 以外をすべてパーセントエンコードする。 */
export function encodeRfc5987(value: string): string {
  return encodeURIComponent(value).replace(/['()*!]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** 改行を持ち込ませず、ASCII の代替名も添えた Content-Disposition を返す。 */
export function attachmentContentDisposition(name: string): string {
  const safe = name.replace(/[\r\n]/g, "").trim() || "download";
  const ascii = safe.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeRfc5987(safe)}`;
}

export function inlineContentDisposition(): string {
  return "inline";
}

const NAMED_ELEMENT = /<\s*(script|foreignObject)\b[\s\S]*?<\s*\/\s*\1\s*>/gi;
const SELF_CLOSED_ELEMENT = /<\s*(script|foreignObject)\b[^>]*\/?>/gi;
const EVENT_HANDLER = /\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const EXTERNAL_REFERENCE = /\s(?:xlink:href|href)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;

/**
 * SVG を DOM へ挿入する場合の最小限の無害化。script / foreignObject / on* /
 * `#` と `data:` 以外の href を除去する。表示は `<img>` 経由を基本とし、これは補助。
 */
export function sanitizeSvgSource(source: string): string {
  return source
    .replace(NAMED_ELEMENT, "")
    .replace(SELF_CLOSED_ELEMENT, "")
    .replace(EVENT_HANDLER, "")
    .replace(EXTERNAL_REFERENCE, (match, raw: string) => {
      const value = raw.replace(/^["']|["']$/g, "").trim();
      return value.startsWith("#") || value.startsWith("data:") ? match : "";
    });
}

/** 添付は 1 始まりの連番で並べる。 */
export function nextIdeaAttachmentPosition(attachments: readonly IdeaAttachment[]): number {
  return attachments.reduce((highest, attachment) => Math.max(highest, attachment.position), 0) + 1;
}

/** チップに出す短いサイズ表記。 */
export function formatIdeaAttachmentBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/**
 * 本文が `/api/attachments/<id>` として参照している添付は、本文中のインライン画像として描画する。
 * 同じ画像を添付欄にも並べないよう、本文が参照しているぶんを添付一覧から取り除く。
 */
export function ideaAttachmentsOutsideBody(
  body: string,
  attachments: readonly IdeaAttachment[],
): readonly IdeaAttachment[] {
  return attachments.filter((attachment) => !bodyReferencesAttachment(body, attachment.id));
}

const ATTACHMENT_ID_CHARACTER = /[0-9A-Za-z_-]/;

/** id は前方一致ではなくトークン境界で判定する（`abc` が `abcd` に一致しない）。 */
function bodyReferencesAttachment(body: string, id: string): boolean {
  const token = `/api/attachments/${id}`;
  let index = body.indexOf(token);
  while (index !== -1) {
    const next = body.charAt(index + token.length);
    if (!ATTACHMENT_ID_CHARACTER.test(next)) return true;
    index = body.indexOf(token, index + 1);
  }
  return false;
}
