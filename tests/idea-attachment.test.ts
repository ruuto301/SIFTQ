import { describe, expect, it } from "vite-plus/test";
import {
  IDEA_ATTACHMENT_CONTENT_TYPES,
  IDEA_ATTACHMENT_FILE_MAX_BYTES,
  IDEA_ATTACHMENT_IMAGE_MAX_BYTES,
  IDEA_ATTACHMENT_MAX_COUNT,
  IDEA_ATTACHMENT_MAX_TOTAL_BYTES,
  attachmentContentDisposition,
  buildIdeaAttachmentKey,
  createIdeaAttachment,
  formatIdeaAttachmentBytes,
  ideaAttachmentKind,
  ideaAttachmentLimitBytes,
  isIdeaAttachment,
  isIdeaAttachmentContentType,
  isIdeaAttachmentPreview,
  matchesIdeaAttachmentMagic,
  nextIdeaAttachmentPosition,
  sanitizeSvgSource,
} from "../src/idea-attachment";
import type { IdeaAttachment } from "../src/idea-attachment";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const GIF = new TextEncoder().encode("GIF89a....");
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const PDF = new TextEncoder().encode("%PDF-1.7\n");
const ZIP = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
const SVG = new TextEncoder().encode('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>');
const HTML = new TextEncoder().encode("<!doctype html><html><body>hi</body></html>");
const JSON_TEXT = new TextEncoder().encode('{"a":1}');
const PLAIN = new TextEncoder().encode("hello, world");

function rawAttachment(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "attachment-1",
    owner_id: "local",
    note_id: "note-1",
    position: 1,
    kind: "image",
    name: "screenshot.webp",
    content_type: "image/webp",
    bytes: 1024,
    r2_key: "attachments/local/202611/attachment-1",
    sha256: "0".repeat(64),
    preview: "inline",
    created_at: "2026-11-01T00:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

function attachment(overrides: Record<string, unknown> = {}): IdeaAttachment {
  const value = rawAttachment(overrides);
  if (!isIdeaAttachment(value)) throw new Error("attachment fixture must stay valid");
  return value;
}

describe("attachment allowlist and limits", () => {
  it("accepts the documented content types and rejects executables", () => {
    for (const type of IDEA_ATTACHMENT_CONTENT_TYPES) {
      expect(isIdeaAttachmentContentType(type)).toBe(true);
    }
    for (const type of [
      "application/javascript",
      "text/javascript",
      "application/x-msdownload",
      "application/x-sh",
      "application/octet-stream",
      "image/bmp",
    ]) {
      expect(isIdeaAttachmentContentType(type)).toBe(false);
    }
  });

  it("uses 5MB for images and 25MB for other files", () => {
    expect(ideaAttachmentLimitBytes("image/png")).toBe(IDEA_ATTACHMENT_IMAGE_MAX_BYTES);
    expect(ideaAttachmentLimitBytes("image/gif")).toBe(IDEA_ATTACHMENT_IMAGE_MAX_BYTES);
    expect(ideaAttachmentLimitBytes("application/pdf")).toBe(IDEA_ATTACHMENT_FILE_MAX_BYTES);
    expect(IDEA_ATTACHMENT_IMAGE_MAX_BYTES).toBe(5 * 1024 * 1024);
    expect(IDEA_ATTACHMENT_FILE_MAX_BYTES).toBe(25 * 1024 * 1024);
    expect(IDEA_ATTACHMENT_MAX_COUNT).toBe(10);
    expect(IDEA_ATTACHMENT_MAX_TOTAL_BYTES).toBe(50 * 1024 * 1024);
  });

  it("derives the kind from the content type", () => {
    expect(ideaAttachmentKind("image/svg+xml")).toBe("image");
    expect(ideaAttachmentKind("image/jpeg")).toBe("image");
    expect(ideaAttachmentKind("text/html")).toBe("file");
  });

  it("formats a size for the chip", () => {
    expect(formatIdeaAttachmentBytes(512)).toBe("512 B");
    expect(formatIdeaAttachmentBytes(2048)).toBe("2 KB");
    expect(formatIdeaAttachmentBytes(2 * 1024 * 1024)).toBe("2.0 MB");
  });
});

describe("attachment validation", () => {
  it("accepts a well-formed attachment and rejects malformed ones", () => {
    expect(isIdeaAttachment(attachment())).toBe(true);
    expect(isIdeaAttachment(rawAttachment({ preview: "sideways" }))).toBe(false);
    expect(isIdeaAttachment(rawAttachment({ kind: "video" }))).toBe(false);
    expect(isIdeaAttachment(rawAttachment({ position: 0 }))).toBe(false);
    expect(isIdeaAttachment(rawAttachment({ name: "" }))).toBe(false);
    expect(isIdeaAttachment(rawAttachment({ bytes: -1 }))).toBe(false);
    expect(isIdeaAttachment(rawAttachment({ deleted_at: 5 }))).toBe(false);
  });

  it("creates a valid attachment with the default inline preview", () => {
    const created = createIdeaAttachment({
      id: "a1",
      owner_id: "local",
      note_id: "n1",
      position: 1,
      kind: "file",
      name: "資料.pdf",
      content_type: "application/pdf",
      bytes: 10,
      r2_key: "attachments/local/202611/a1",
      sha256: "abc",
      created_at: "2026-11-01T00:00:00.000Z",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.preview).toBe("inline");
    expect(isIdeaAttachmentPreview("download")).toBe(true);
    expect(isIdeaAttachmentPreview("raw")).toBe(false);
  });

  it("returns INVALID_ATTACHMENT for a malformed input", () => {
    const created = createIdeaAttachment({
      id: "",
      owner_id: "local",
      note_id: "n1",
      position: 1,
      kind: "file",
      name: "x",
      content_type: "text/plain",
      bytes: 1,
      r2_key: "k",
      sha256: "s",
      created_at: "2026-11-01T00:00:00.000Z",
    });
    expect(created).toEqual({ ok: false, error: { code: "INVALID_ATTACHMENT" } });
  });
});

describe("attachment R2 key", () => {
  it("builds owner and month scoped keys", () => {
    expect(buildIdeaAttachmentKey("local", "2026-11-05T10:00:00.000Z", "abc-123")).toBe(
      "attachments/local/202611/abc-123",
    );
  });

  it("rejects unsafe segments and timestamps", () => {
    expect(buildIdeaAttachmentKey("../etc", "2026-11-05T10:00:00.000Z", "abc")).toBeNull();
    expect(buildIdeaAttachmentKey("local", "not-a-date", "abc")).toBeNull();
    expect(buildIdeaAttachmentKey("local", "2026-11-05T10:00:00.000Z", "a/b")).toBeNull();
  });
});

describe("attachment magic bytes", () => {
  it("accepts bytes that match the declared type", () => {
    expect(matchesIdeaAttachmentMagic("image/png", PNG)).toBe(true);
    expect(matchesIdeaAttachmentMagic("image/jpeg", JPEG)).toBe(true);
    expect(matchesIdeaAttachmentMagic("image/gif", GIF)).toBe(true);
    expect(matchesIdeaAttachmentMagic("image/webp", WEBP)).toBe(true);
    expect(matchesIdeaAttachmentMagic("application/pdf", PDF)).toBe(true);
    expect(matchesIdeaAttachmentMagic("application/zip", ZIP)).toBe(true);
    expect(matchesIdeaAttachmentMagic("image/svg+xml", SVG)).toBe(true);
    expect(matchesIdeaAttachmentMagic("text/html", HTML)).toBe(true);
    expect(matchesIdeaAttachmentMagic("application/json", JSON_TEXT)).toBe(true);
    expect(matchesIdeaAttachmentMagic("text/plain", PLAIN)).toBe(true);
    expect(matchesIdeaAttachmentMagic("text/markdown", PLAIN)).toBe(true);
    expect(matchesIdeaAttachmentMagic("text/csv", PLAIN)).toBe(true);
  });

  it("rejects bytes that contradict the declared type", () => {
    expect(matchesIdeaAttachmentMagic("image/png", PLAIN)).toBe(false);
    expect(matchesIdeaAttachmentMagic("application/pdf", PNG)).toBe(false);
    expect(matchesIdeaAttachmentMagic("text/plain", PNG)).toBe(false);
    expect(matchesIdeaAttachmentMagic("text/html", SVG)).toBe(false);
    expect(matchesIdeaAttachmentMagic("image/svg+xml", HTML)).toBe(false);
  });

  it("keeps textual files that merely look like JSON or HTML", () => {
    expect(matchesIdeaAttachmentMagic("text/plain", JSON_TEXT)).toBe(true);
    expect(matchesIdeaAttachmentMagic("text/markdown", HTML)).toBe(true);
    expect(matchesIdeaAttachmentMagic("text/csv", new Uint8Array([0x61, 0x00, 0x62]))).toBe(false);
  });

  it("rejects native executables declared as downloads", () => {
    expect(matchesIdeaAttachmentMagic("application/zip", new Uint8Array([0x7f, 0x45, 0x4c, 0x46]))).toBe(false);
    expect(matchesIdeaAttachmentMagic("text/plain", new Uint8Array([0x4d, 0x5a, 0x90]))).toBe(false);
  });
});

describe("attachment file name header", () => {
  it("escapes non-ASCII names with RFC 5987", () => {
    const header = attachmentContentDisposition("資料 1.pdf");

    expect(header.startsWith("attachment; filename=")).toBe(true);
    expect(header).toContain("filename*=UTF-8''%E8%B3%87%E6%96%99%201.pdf");
  });

  it("keeps quotes out of the ASCII fallback and strips newlines", () => {
    const header = attachmentContentDisposition('a"b\\c\r\nx.txt');

    expect(header).not.toContain("\r");
    expect(header).not.toContain("\n");
    expect(header).toContain('filename="a_b_cx.txt"');
  });

  it("falls back to a download name when the name is blank", () => {
    expect(attachmentContentDisposition("   ")).toContain("filename*=UTF-8''download");
  });
});

describe("SVG sanitizer", () => {
  it("removes scripts and foreignObject", () => {
    const source =
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><foreignObject><b>x</b></foreignObject><circle r="4"/></svg>';
    const safe = sanitizeSvgSource(source);

    expect(safe).not.toContain("script");
    expect(safe).not.toContain("foreignObject");
    expect(safe).toContain("<circle");
  });

  it("removes event handlers and external references", () => {
    const source =
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.example/x.png"/><a xlink:href="javascript:alert(1)"><text onmouseover="alert(1)" onload=\'x\'>t</text></a><use href="#local"/><image href="data:image/png;base64,AA"/></svg>';
    const safe = sanitizeSvgSource(source);

    expect(safe).not.toContain("onmouseover");
    expect(safe).not.toContain("onload");
    expect(safe).not.toContain("evil.example");
    expect(safe).not.toContain("javascript:");
    expect(safe).toContain('href="#local"');
    expect(safe).toContain("data:image/png");
  });
});

describe("attachment positions", () => {
  it("appends after the highest position even after removals", () => {
    expect(nextIdeaAttachmentPosition([])).toBe(1);
    expect(nextIdeaAttachmentPosition([attachment({ position: 1 }), attachment({ id: "b", position: 7 })])).toBe(8);
  });
});
