import type { MkLinkPreview } from "./mk";
import { err, ok } from "./task";
import type { Result } from "./task";

export type MkPreviewErrorCode = "INVALID_URL" | "PREVIEW_FAILED";

export const MK_PREVIEW_TIMEOUT_MS = 5_000;
export const MK_PREVIEW_MAX_BYTES = 512 * 1024;
export const MK_PREVIEW_MAX_REDIRECTS = 3;
export const MK_PREVIEW_USER_AGENT = "siftq-mk-preview/1.0";

const ALLOWED_PROTOCOLS = ["http:", "https:"];
const HTML_CONTENT_TYPES = ["text/html", "application/xhtml+xml"];
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const META_TAG = /<meta\b[^>]*>/gi;
const TITLE_TAG = /<title[^>]*>([\s\S]*?)<\/title>/i;
const ENTITY = /&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g;
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const TRAILING_PUNCTUATION = new Set([")", "]", ",", ".", ";", ":", "!", "?", "'", '"', "。", "、", "）", "】", "」", "』"]);
const LEADING_PUNCTUATION = /^[([{（【「『]+/;
const IPV4_MAPPED_PREFIX = `${":".repeat(2)}ffff:`;

function isAllowedProtocol(url: URL): boolean {
  return ALLOWED_PROTOCOLS.includes(url.protocol);
}

function toOctet(value: string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 255 ? parsed : null;
}

/** Rejects loopback, private, link-local, carrier-grade NAT, and reserved IPv4 literals. */
function isPrivateIpv4Range(first: number, second: number): boolean {
  if (first === 0 || first === 10 || first === 127) return true;
  if (first === 169 && second === 254) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 192 && second === 168) return true;
  return first === 100 && second >= 64 && second <= 127;
}

function isBlockedIpv4(host: string): boolean {
  const match = IPV4.exec(host);
  if (match === null) return false;
  const first = toOctet(match[1]);
  const second = toOctet(match[2]);
  if (first === null || second === null) return false;
  return first >= 224 || isPrivateIpv4Range(first, second);
}

function unmapIpv4(host: string): string | null {
  if (!host.startsWith(IPV4_MAPPED_PREFIX)) return null;
  const tail = host.slice(IPV4_MAPPED_PREFIX.length);
  if (tail.includes(".")) return tail;
  const groups = tail.split(":");
  if (groups.length !== 2) return null;
  const high = Number.parseInt(groups[0] ?? "", 16);
  const low = Number.parseInt(groups[1] ?? "", 16);
  if (Number.isNaN(high) || Number.isNaN(low)) return null;
  return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
}

function isBlockedIpv6(host: string): boolean {
  if (!host.includes(":")) return false;
  if (host === `${":".repeat(2)}1` || host === ":".repeat(2)) return true;
  const head = host.startsWith("::") ? host.slice(2).split(":")[0] : host.split(":")[0];
  const value = Number.parseInt(head ?? "", 16);
  if (Number.isNaN(value)) return false;
  if ((value & 0xfe00) === 0xfc00) return true;
  return (value & 0xffc0) === 0xfe80;
}

export function isBlockedPreviewHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".localhost") || host.endsWith(".internal")) {
    return true;
  }
  const mapped = unmapIpv4(host);
  if (mapped !== null) return isBlockedIpv4(mapped);
  return isBlockedIpv4(host) || isBlockedIpv6(host);
}

/** Accepts only http(s) URLs whose host is not a local or private address. */
export function parseMkPreviewUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  try {
    const url = new URL(trimmed);
    if (!isAllowedProtocol(url) || isBlockedPreviewHostname(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

function trimTrailingPunctuation(value: string): string {
  let end = value.length;
  while (end > 0 && TRAILING_PUNCTUATION.has(value.slice(end - 1, end))) end -= 1;
  return value.slice(0, end);
}

/** Finds the first safe URL in free text, so a note body can carry a bare link. */
export function extractMkPreviewUrl(text: string): string | null {
  for (const token of text.split(/\s+/)) {
    const candidate = trimTrailingPunctuation(token.replace(LEADING_PUNCTUATION, ""));
    if (!candidate.includes(":")) continue;
    if (parseMkPreviewUrl(candidate) !== null) return candidate;
  }
  return null;
}

function decodeHtmlEntities(value: string): string {
  return value.replace(ENTITY, (entity, code: string) => {
    if (!code.startsWith("#")) return ENTITIES[code.toLowerCase()] ?? entity;
    const radix = code[1] === "x" || code[1] === "X" ? 16 : 10;
    const parsed = Number.parseInt(radix === 16 ? code.slice(2) : code.slice(1), radix);
    return Number.isNaN(parsed) || parsed < 0 || parsed > 0x10ffff ? entity : String.fromCodePoint(parsed);
  });
}

function isAttributeBoundary(tag: string, at: number): boolean {
  return at === 0 || tag[at - 1] === " " || tag[at - 1] === "\t" || tag[at - 1] === "\n";
}

function readQuotedAttributeValue(tag: string, lower: string, cursor: number): string | null {
  let at = cursor;
  while (lower[at] === " ") at += 1;
  if (lower[at] !== "=") return null;
  at += 1;
  while (lower[at] === " ") at += 1;
  const quote = lower[at];
  if (quote !== '"' && quote !== "'") return null;
  const end = lower.indexOf(quote, at + 1);
  return end < 0 ? null : tag.slice(at + 1, end);
}

/** Reads one HTML attribute without a combined regex, which keeps the scan linear. */
function readTagAttribute(tag: string, name: string): string | null {
  const lower = tag.toLowerCase();
  let from = 0;
  for (;;) {
    const at = lower.indexOf(name, from);
    if (at < 0) return null;
    from = at + name.length;
    if (!isAttributeBoundary(lower, at)) continue;
    const value = readQuotedAttributeValue(tag, lower, from);
    if (value !== null) return value;
  }
}

function readMetaTags(html: string): Record<string, string> {
  const metas: Record<string, string> = {};
  for (const tag of html.match(META_TAG) ?? []) {
    const key = (readTagAttribute(tag, "property") ?? readTagAttribute(tag, "name") ?? "").trim().toLowerCase();
    const content = readTagAttribute(tag, "content");
    if (key !== "" && content !== null && metas[key] === undefined) metas[key] = content;
  }
  return metas;
}

function firstFilled(values: readonly (string | undefined)[]): string {
  for (const value of values) {
    if (value !== undefined && value.trim() !== "") return value.trim();
  }
  return "";
}

function resolvePreviewImage(value: string, base: string): string | null {
  if (value === "") return null;
  try {
    const url = new URL(value, base);
    return isAllowedProtocol(url) ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Reads Open Graph, Twitter, and plain HTML metadata into the preview columns. */
export function extractMkLinkPreview(html: string, finalUrl: string): MkLinkPreview {
  const metas = readMetaTags(html);
  const title = firstFilled([metas["og:title"], metas["twitter:title"], TITLE_TAG.exec(html)?.[1]]);
  const description = firstFilled([metas["og:description"], metas["twitter:description"], metas["description"]]);
  const image = resolvePreviewImage(firstFilled([metas["og:image"], metas["twitter:image"]]), finalUrl);
  return {
    title: decodeHtmlEntities(title),
    description: decodeHtmlEntities(description),
    image,
    domain: new URL(finalUrl).hostname,
  };
}

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function isHtmlContentType(value: string | null): boolean {
  if (value === null) return false;
  return HTML_CONTENT_TYPES.includes((value.split(";")[0] ?? "").trim().toLowerCase());
}

async function requestPreviewPage(url: URL): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MK_PREVIEW_TIMEOUT_MS);
  try {
    return await fetch(url.toString(), {
      redirect: "manual",
      signal: controller.signal,
      headers: { accept: HTML_CONTENT_TYPES.join(", "), "user-agent": MK_PREVIEW_USER_AGENT },
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function readCappedText(response: Response): Promise<string | null> {
  const declared = Number(response.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > MK_PREVIEW_MAX_BYTES) return null;
  if (response.body === null) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let total = 0;
  for (;;) {
    const step = await reader.read();
    if (step.done) break;
    total += step.value.byteLength;
    text += decoder.decode(step.value, { stream: true });
    if (total >= MK_PREVIEW_MAX_BYTES) {
      await reader.cancel();
      break;
    }
  }
  return text + decoder.decode();
}

/** Follows redirects manually so every hop is validated against the SSRF rules. */
function redirectTarget(response: Response, base: URL): URL | null {
  if (!isRedirectStatus(response.status)) return null;
  const location = response.headers.get("location");
  if (location === null) return null;
  try {
    return parseMkPreviewUrl(new URL(location, base).toString());
  } catch {
    return null;
  }
}

type PreviewPage = { finalUrl: URL; html: string };

async function readPreviewPage(start: URL): Promise<PreviewPage | null> {
  let current = start;
  for (let hop = 0; hop <= MK_PREVIEW_MAX_REDIRECTS; hop += 1) {
    const response = await requestPreviewPage(current);
    if (response === null) return null;
    const next = redirectTarget(response, current);
    if (next !== null) {
      current = next;
      continue;
    }
    if (!response.ok || !isHtmlContentType(response.headers.get("content-type"))) return null;
    const html = await readCappedText(response);
    return html === null ? null : { finalUrl: current, html };
  }
  return null;
}

/** Fetches the page behind one note URL; failures record nothing so the card stays a plain link. */
export async function fetchMkLinkPreview(rawUrl: string): Promise<Result<MkLinkPreview, MkPreviewErrorCode>> {
  const start = parseMkPreviewUrl(rawUrl);
  if (start === null) return err("INVALID_URL");
  const page = await readPreviewPage(start);
  if (page === null) return err("PREVIEW_FAILED");
  return ok(extractMkLinkPreview(page.html, page.finalUrl.toString()));
}
