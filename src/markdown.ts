/**
 * Dependency-free Markdown renderer for the CommonMark/GFM subset used by task
 * descriptions.
 *
 * Safety rules:
 * - the source is HTML-escaped before it becomes markup, so raw HTML in the
 *   source is rendered as text,
 * - every URL passes {@link isSafeUrl} before it reaches `href`/`src`,
 * - links carry `rel="noopener noreferrer"` and images carry `loading="lazy"`.
 *
 * Supported blocks: ATX headings, paragraphs, fenced code, blockquotes,
 * thematic breaks, unordered/ordered lists (including `- [ ]` task items) and
 * simple pipe tables. Supported inline spans: code, bold, italic,
 * strikethrough, links, images and http/https autolinks.
 */

const SAFE_URL_PREFIXES = ["http://", "https://", "mailto:"];
const INLINE_MAX_DEPTH = 4;

const HEADING_PATTERN = /^ {0,3}(#{1,6}) (.*)$/;
const BLOCKQUOTE_PATTERN = /^ {0,3}> ?/;
const UNORDERED_ITEM_PATTERN = /^ {0,3}[-*+] (.*)$/;
const ORDERED_ITEM_PATTERN = /^ {0,3}(\d{1,9})[.)] (.*)$/;
const TASK_ITEM_PATTERN = /^\[([ xX])\] (.*)$/;

type BlockResult = { html: string; next: number };
type InlineToken = { html: string; next: number };
type LinkParts = { label: string; url: string; next: number };
type ListItem = { text: string; ordered: boolean; ordinal: number };
type Fence = { fence: string; language: string };

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Only absolute http/https, mailto and root-relative URLs may reach an attribute. */
export function isSafeUrl(url: string): boolean {
  const candidate = url.trim().toLowerCase();
  if (candidate.startsWith("//")) return false;
  if (SAFE_URL_PREFIXES.some((prefix) => candidate.startsWith(prefix))) return true;
  return candidate.startsWith("/");
}

function isSpace(char: string): boolean {
  return char === " " || char === "\t" || char === "\n";
}

function isWordChar(char: string): boolean {
  return /\w/.test(char);
}

function trimStart(value: string): string {
  let start = 0;
  while (start < value.length && isSpace(value.charAt(start))) start += 1;
  return value.slice(start);
}

function trimEnd(value: string): string {
  let end = value.length;
  while (end > 0 && isSpace(value.charAt(end - 1))) end -= 1;
  return value.slice(0, end);
}

function trimTrailingPunctuation(value: string): string {
  let end = value.length;
  while (end > 0 && ".,!?;:".includes(value.charAt(end - 1))) end -= 1;
  return value.slice(0, end);
}

function lineAt(lines: readonly string[], index: number): string {
  const line = lines[index];
  return line === undefined ? "" : line;
}

function isBlank(line: string): boolean {
  return line.trim() === "";
}

function firstToken(value: string): string {
  let end = 0;
  while (end < value.length && !isSpace(value.charAt(end))) end += 1;
  return value.slice(0, end);
}

function renderImage(alt: string, url: string): string {
  if (!isSafeUrl(url)) return `![${alt}](${url})`;
  return `<img src="${url}" alt="${alt}" loading="lazy">`;
}

function renderLink(label: string, url: string, depth: number): string {
  const text = renderInlineEscaped(label, depth + 1);
  if (!isSafeUrl(url)) return `[${text}](${url})`;
  return `<a href="${url}" rel="noopener noreferrer">${text}</a>`;
}

function renderAutoLink(url: string): string {
  if (!isSafeUrl(url)) return url;
  return `<a href="${url}" rel="noopener noreferrer">${url}</a>`;
}

function codeSpanAt(text: string, index: number): InlineToken | null {
  const fence = "`".repeat(backtickRun(text, index));
  const closing = text.indexOf(fence, index + fence.length);
  if (closing === -1) return null;
  const code = text.slice(index + fence.length, closing).trim();
  return { html: `<code>${code}</code>`, next: closing + fence.length };
}

function backtickRun(text: string, index: number): number {
  let end = index;
  while (text.charAt(end) === "`") end += 1;
  return end - index;
}

function linkPartsAt(text: string, index: number): LinkParts | null {
  if (text.charAt(index) !== "[") return null;
  const labelEnd = text.indexOf("]", index + 1);
  if (labelEnd === -1 || text.charAt(labelEnd + 1) !== "(") return null;
  const targetEnd = text.indexOf(")", labelEnd + 2);
  if (targetEnd === -1) return null;
  const url = firstToken(text.slice(labelEnd + 2, targetEnd).trim());
  if (url === "") return null;
  return { label: text.slice(index + 1, labelEnd), url, next: targetEnd + 1 };
}

function linkAt(text: string, index: number, depth: number): InlineToken | null {
  const parts = linkPartsAt(text, index);
  if (parts === null) return null;
  return { html: renderLink(parts.label, parts.url, depth), next: parts.next };
}

function imageAt(text: string, index: number): InlineToken | null {
  const parts = linkPartsAt(text, index + 1);
  if (parts === null) return null;
  return { html: renderImage(parts.label, parts.url), next: parts.next };
}

function autoLinkAt(text: string, index: number): InlineToken | null {
  if (!text.startsWith("http://", index) && !text.startsWith("https://", index)) return null;
  if (isWordChar(text.charAt(index - 1))) return null;
  let end = index;
  while (end < text.length && !isSpace(text.charAt(end)) && text.charAt(end) !== ")" && text.charAt(end) !== "<") {
    end += 1;
  }
  const raw = text.slice(index, end);
  const url = trimTrailingPunctuation(raw);
  if (url === "") return null;
  return { html: `${renderAutoLink(url)}${raw.slice(url.length)}`, next: end };
}

function emphasisTag(char: string, runLength: number): string | null {
  if (char === "~") {
    return runLength === 2 ? "del" : null;
  }
  return runLength === 2 ? "strong" : "em";
}

function isFlanking(inner: string): boolean {
  if (inner === "") return false;
  return !isSpace(inner.charAt(0)) && !isSpace(inner.charAt(inner.length - 1));
}

function findClosingDelimiter(text: string, from: number, char: string, length: number): number {
  const delimiter = char.repeat(length);
  let cursor = from;
  while (cursor < text.length) {
    const found = text.indexOf(delimiter, cursor);
    if (found === -1) return -1;
    if (text.charAt(found + length) === char) {
      cursor = found + length;
      while (text.charAt(cursor) === char) cursor += 1;
      continue;
    }
    return found;
  }
  return -1;
}

function emphasisAt(text: string, index: number, depth: number): InlineToken | null {
  const char = text.charAt(index);
  if (text.charAt(index - 1) === char) return null;
  const runLength = text.charAt(index + 1) === char ? 2 : 1;
  const tag = emphasisTag(char, runLength);
  if (tag === null) return null;
  const closing = findClosingDelimiter(text, index + runLength, char, runLength);
  if (closing === -1) return null;
  const inner = text.slice(index + runLength, closing);
  if (!isFlanking(inner)) return null;
  const after = text.charAt(closing + runLength);
  if (char === "_" && (isWordChar(text.charAt(index - 1)) || isWordChar(after))) return null;
  return { html: `<${tag}>${renderInlineEscaped(inner, depth + 1)}</${tag}>`, next: closing + runLength };
}

function inlineTokenAt(text: string, index: number, depth: number): InlineToken | null {
  const char = text.charAt(index);
  if (char === "`") return codeSpanAt(text, index);
  if (char === "!" && text.charAt(index + 1) === "[") return imageAt(text, index);
  if (char === "[") return linkAt(text, index, depth);
  if (char === "h") return autoLinkAt(text, index);
  if (char === "*" || char === "_" || char === "~") return emphasisAt(text, index, depth);
  return null;
}

/** Renders inline spans of an already escaped line. */
function renderInlineEscaped(escaped: string, depth: number): string {
  if (depth >= INLINE_MAX_DEPTH) return escaped;
  const out: string[] = [];
  let index = 0;
  while (index < escaped.length) {
    const token = inlineTokenAt(escaped, index, depth);
    if (token === null) {
      out.push(escaped.charAt(index));
      index += 1;
      continue;
    }
    out.push(token.html);
    index = token.next;
  }
  return out.join("");
}

function renderInline(source: string): string {
  return renderInlineEscaped(escapeHtml(source), 0);
}

function isClosingFence(line: string, fence: string): boolean {
  const marker = fence.charAt(0);
  const trimmed = line.trim();
  if (trimmed.length < fence.length) return false;
  return trimmed.split("").every((char) => char === marker);
}

/** Reads an opening code fence. The info string may not contain a backtick. */
function fenceAt(line: string): Fence | null {
  const trimmed = line.trim();
  const marker = trimmed.charAt(0);
  if (marker !== "`" && marker !== "~") return null;
  let end = 0;
  while (trimmed.charAt(end) === marker) end += 1;
  if (end < 3) return null;
  const info = trimStart(trimmed.slice(end));
  if (marker === "`" && info.includes("`")) return null;
  return { fence: marker.repeat(end), language: info };
}

function renderFencedCode(lines: readonly string[], index: number): BlockResult | null {
  const opening = fenceAt(lineAt(lines, index));
  if (opening === null) return null;
  const body: string[] = [];
  let cursor = index + 1;
  while (cursor < lines.length && !isClosingFence(lineAt(lines, cursor), opening.fence)) {
    body.push(lineAt(lines, cursor));
    cursor += 1;
  }
  const language = opening.language.replace(/[^A-Za-z0-9_+-]/g, "");
  const className = language === "" ? "" : ` class="language-${language}"`;
  const html = `<pre><code${className}>${escapeHtml(body.join("\n"))}</code></pre>`;
  return { html, next: cursor < lines.length ? cursor + 1 : cursor };
}

/** Strips a closing `#` run, which CommonMark only recognizes after a space. */
function stripClosingHashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charAt(end - 1) === "#") end -= 1;
  if (end === value.length) return value;
  if (end === 0) return "";
  if (!isSpace(value.charAt(end - 1))) return value;
  return trimEnd(value.slice(0, end));
}

function renderHeading(line: string): string | null {
  const match = HEADING_PATTERN.exec(line);
  if (match === null) return null;
  const level = (match[1] ?? "").length;
  const text = stripClosingHashes(trimStart(match[2] ?? ""));
  return `<h${level}>${renderInline(text)}</h${level}>`;
}

function isThematicBreak(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 3) return false;
  const marker = trimmed.charAt(0);
  if (marker !== "-" && marker !== "*" && marker !== "_") return false;
  return trimmed.split("").every((char) => char === marker || char === " ");
}

function renderBlockquote(lines: readonly string[], index: number): BlockResult {
  const inner: string[] = [];
  let cursor = index;
  while (cursor < lines.length && BLOCKQUOTE_PATTERN.test(lineAt(lines, cursor))) {
    inner.push(lineAt(lines, cursor).replace(BLOCKQUOTE_PATTERN, ""));
    cursor += 1;
  }
  return { html: `<blockquote>\n${renderBlocks(inner)}\n</blockquote>`, next: cursor };
}

function listItemAt(line: string): ListItem | null {
  const unordered = UNORDERED_ITEM_PATTERN.exec(line);
  if (unordered !== null) return { text: unordered[1] ?? "", ordered: false, ordinal: 1 };
  const ordered = ORDERED_ITEM_PATTERN.exec(line);
  if (ordered === null) return null;
  return { text: ordered[2] ?? "", ordered: true, ordinal: Number(ordered[1]) };
}

function renderListItem(text: string): string {
  const task = TASK_ITEM_PATTERN.exec(text);
  if (task === null) return `<li>${renderInline(text)}</li>`;
  const checked = (task[1] ?? "").toLowerCase() === "x" ? " checked" : "";
  return `<li class="task-list-item"><input type="checkbox" disabled${checked}> ${renderInline(task[2] ?? "")}</li>`;
}

function renderList(lines: readonly string[], index: number): BlockResult {
  const first = listItemAt(lineAt(lines, index));
  const ordered = first !== null && first.ordered;
  const items: string[] = [];
  let cursor = index;
  while (cursor < lines.length) {
    const item = listItemAt(lineAt(lines, cursor));
    if (item === null || item.ordered !== ordered) break;
    items.push(renderListItem(item.text));
    cursor += 1;
  }
  const tag = ordered ? "ol" : "ul";
  const start = ordered && first !== null && first.ordinal !== 1 ? ` start="${first.ordinal}"` : "";
  return { html: `<${tag}${start}>\n${items.join("\n")}\n</${tag}>`, next: cursor };
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableDelimiterRow(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed === "" || !/^[|: -]+$/.test(trimmed)) return false;
  return splitTableRow(trimmed).every((cell) => /^:?-+:?$/.test(cell));
}

function isTableStart(lines: readonly string[], index: number): boolean {
  if (!lineAt(lines, index).includes("|")) return false;
  return isTableDelimiterRow(lineAt(lines, index + 1));
}

function tableCells(cells: readonly string[], count: number): string {
  const rendered: string[] = [];
  for (let index = 0; index < count; index += 1) {
    rendered.push(`<td>${renderInline(cells[index] ?? "")}</td>`);
  }
  return rendered.join("");
}

function renderTable(lines: readonly string[], index: number): BlockResult {
  const headers = splitTableRow(lineAt(lines, index));
  const rows: string[][] = [];
  let cursor = index + 2;
  while (cursor < lines.length && !isBlank(lineAt(lines, cursor)) && lineAt(lines, cursor).includes("|")) {
    rows.push(splitTableRow(lineAt(lines, cursor)));
    cursor += 1;
  }
  const head = headers.map((cell) => `<th>${renderInline(cell)}</th>`).join("");
  const body = rows.map((row) => `<tr>${tableCells(row, headers.length)}</tr>`).join("\n");
  const tbody = body === "" ? "" : `\n<tbody>\n${body}\n</tbody>`;
  return { html: `<table>\n<thead>\n<tr>${head}</tr>\n</thead>${tbody}\n</table>`, next: cursor };
}

function isBlockStart(lines: readonly string[], index: number): boolean {
  const line = lineAt(lines, index);
  if (isBlank(line)) return true;
  if (fenceAt(line) !== null) return true;
  if (HEADING_PATTERN.test(line)) return true;
  if (isThematicBreak(line)) return true;
  if (BLOCKQUOTE_PATTERN.test(line)) return true;
  if (listItemAt(line) !== null) return true;
  return isTableStart(lines, index);
}

function renderParagraph(lines: readonly string[], index: number): BlockResult {
  const body: string[] = [];
  let cursor = index;
  while (cursor < lines.length && !isBlockStart(lines, cursor)) {
    body.push(lineAt(lines, cursor).trim());
    cursor += 1;
  }
  if (body.length === 0) {
    body.push(lineAt(lines, index).trim());
    cursor = index + 1;
  }
  return { html: `<p>${renderInline(body.join("\n"))}</p>`, next: cursor };
}

function renderBlock(lines: readonly string[], index: number): BlockResult {
  const line = lineAt(lines, index);
  const fence = renderFencedCode(lines, index);
  if (fence !== null) return fence;
  const heading = renderHeading(line);
  if (heading !== null) return { html: heading, next: index + 1 };
  if (isThematicBreak(line)) return { html: "<hr>", next: index + 1 };
  if (BLOCKQUOTE_PATTERN.test(line)) return renderBlockquote(lines, index);
  if (isTableStart(lines, index)) return renderTable(lines, index);
  if (listItemAt(line) !== null) return renderList(lines, index);
  return renderParagraph(lines, index);
}

function renderBlocks(lines: readonly string[]): string {
  const blocks: string[] = [];
  let index = 0;
  while (index < lines.length) {
    if (isBlank(lineAt(lines, index))) {
      index += 1;
      continue;
    }
    const block = renderBlock(lines, index);
    blocks.push(block.html);
    index = block.next;
  }
  return blocks.join("\n");
}

/** Renders a Markdown source string to safe HTML. */
export function renderMarkdown(source: string): string {
  return renderBlocks(source.replace(/\r\n?/g, "\n").split("\n"));
}
