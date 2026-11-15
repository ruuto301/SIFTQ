import type { Hono } from "hono";
import { renderMarkdown } from "../markdown";
import { isTaskDescriptionValid } from "../task";
import { problem, readJsonRecord } from "./api-helpers";
import type { AppEnv } from "../app-env";

const CACHE_LIMIT = 100;

type CacheEntry = { text: string; html: string };

const previewCache = new Map<number, CacheEntry>();

/** FNV-1a over the text keeps the key small; the entry keeps the text to verify it. */
function hashText(text: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function rememberPreview(key: number, entry: CacheEntry): void {
  if (previewCache.size >= CACHE_LIMIT) {
    const oldest = previewCache.keys().next();
    if (oldest.done !== true) previewCache.delete(oldest.value);
  }
  previewCache.set(key, entry);
}

/** Renders a description through the bounded cache shared by every request. */
function renderPreview(text: string): string {
  const key = hashText(text);
  const cached = previewCache.get(key);
  if (cached !== undefined && cached.text === text) return cached.html;
  const html = renderMarkdown(text);
  rememberPreview(key, { text, html });
  return html;
}

function isMarkdownRequest(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function registerMarkdownApiRoutes(app: Hono<AppEnv>) {
  app.post("/api/markdown/preview", async (c) => {
    const body = await readJsonRecord(c, isMarkdownRequest);
    if (body === null) return problem(c, 400, "INVALID_INPUT");
    const text = body["text"];
    if (typeof text !== "string") return problem(c, 400, "INVALID_INPUT");
    if (!isTaskDescriptionValid(text)) return problem(c, 400, "INVALID_DESCRIPTION");
    return c.json({ html: renderPreview(text) }, 200);
  });
}
