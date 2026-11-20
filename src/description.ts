import { displayUrl } from "./url-display";

export type DescriptionSegment = { text: string; href?: string; src?: string };

/** Ideas の本文は Markdown 画像として貼り付けるため、`![](<path>)` も 1 セグメントにまとめる。 */
const DESCRIPTION_IMAGE_PATH = String.raw`\/api\/(?:images|attachments)\/[0-9A-Za-z_-]+`;
const DESCRIPTION_PATTERN = new RegExp(
  String.raw`!\[\]\(\s*(${DESCRIPTION_IMAGE_PATH})\s*\)|${DESCRIPTION_IMAGE_PATH}|https?:\/\/[^\s<>]+`,
  "g",
);
const DESCRIPTION_TRAILING_PUNCTUATION = ".,!?;:";

/** 画像として描画するパスかどうか。Markdown の括弧を除いた裸のパスも受け付ける。 */
function isDescriptionImagePath(value: string): boolean {
  return value.startsWith("/api/images/") || value.startsWith("/api/attachments/");
}

function isDescriptionBoundary(character: string | undefined): boolean {
  return character === undefined || /[\s<>]/.test(character);
}

function trimDescriptionPunctuation(url: string): string {
  let end = url.length;
  while (end > 0 && DESCRIPTION_TRAILING_PUNCTUATION.includes(url.charAt(end - 1))) end -= 1;
  return url.slice(0, end);
}

/** 画像パスのセグメント。画像でなければ null。 */
function descriptionImageSegment(matched: string, captured: string | undefined): DescriptionSegment | null {
  const source = captured ?? (isDescriptionImagePath(matched) ? matched : "");
  return source === "" ? null : { text: source, src: source };
}

/** URL を境界まで伸ばし、末尾の句読点をテキストとして切り離す。 */
function descriptionLinkSegments(
  description: string,
  start: number,
  matched: string,
): { segments: DescriptionSegment[]; length: number } {
  let end = start + matched.length;
  while (!isDescriptionBoundary(description[end])) end += 1;

  const rawUrl = description.slice(start, end);
  const url = trimDescriptionPunctuation(rawUrl);
  if (url === "") return { segments: [{ text: rawUrl }], length: rawUrl.length };

  const segments: DescriptionSegment[] = [{ text: displayUrl(url), href: url }];
  if (url.length < rawUrl.length) segments.push({ text: rawUrl.slice(url.length) });
  return { segments: segments, length: rawUrl.length };
}

export function splitDescription(description: string): DescriptionSegment[] {
  const segments: DescriptionSegment[] = [];
  let cursor = 0;

  for (const match of description.matchAll(DESCRIPTION_PATTERN)) {
    const matched = match[0];
    const start = match.index ?? cursor;

    if (start > cursor) segments.push({ text: description.slice(cursor, start) });

    const image = descriptionImageSegment(matched, match[1]);
    if (image !== null) {
      segments.push(image);
      cursor = start + matched.length;
      continue;
    }

    const link = descriptionLinkSegments(description, start, matched);
    segments.push(...link.segments);
    cursor = start + link.length;
  }

  if (cursor < description.length) segments.push({ text: description.slice(cursor) });
  return segments;
}
