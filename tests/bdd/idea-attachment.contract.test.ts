import { beforeEach, describe, expect, it } from "vite-plus/test";
import app from "../../src/index";
import { SESSION_COOKIE_NAME, createSession } from "../../src/auth";
import { createMemoryIdeaRepository } from "../../src/preview/MemoryIdeaRepository";
import {
  IDEA_ATTACHMENT_FILE_MAX_BYTES,
  IDEA_ATTACHMENT_IMAGE_MAX_BYTES,
  IDEA_ATTACHMENT_MAX_COUNT,
} from "../../src/idea-attachment";
import { createMemoryAttachmentBucket } from "../helpers/memory-attachment-bucket";
import type { MemoryAttachmentBucket } from "../helpers/memory-attachment-bucket";
import type { IdeaAttachment } from "../../src/idea-attachment";
import type { IdeaRepository } from "../../src/repository/idea-repository";

const SECRET = "idea-attachment-contract-secret";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02, 0x03]);
const PDF = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n");
const SVG = new TextEncoder().encode('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><circle r="4"/></svg>');
const HTML = new TextEncoder().encode('<!doctype html><html><body><script>alert(1)</script></body></html>');

let repo: IdeaRepository;
let bucket: MemoryAttachmentBucket;

beforeEach(() => {
  repo = createMemoryIdeaRepository();
  bucket = createMemoryAttachmentBucket();
});

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const cookie = await createSession(SECRET, Date.now() + 60_000);
  const headers = new Headers(init.headers);
  headers.set("Cookie", `${SESSION_COOKIE_NAME}=${cookie}`);
  return app.request(path, { ...init, headers }, { SESSION_SECRET: SECRET, IDEA_REPOSITORY: repo, ATTACHMENTS: bucket });
}

async function createNote(title: string): Promise<string> {
  const response = await request("/api/ideas/notes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title }),
  });
  expect(response.status).toBe(201);
  const note: { id: string } = await response.json();
  return note.id;
}

function upload(noteId: string, name: string, type: string, bytes: Uint8Array): Promise<Response> {
  const form = new FormData();
  form.append("file", new File([new Uint8Array(bytes)], name, { type }));
  return request(`/api/ideas/notes/${noteId}/attachments`, { method: "POST", body: form });
}

type Uploaded = { id: string; name: string; content_type: string; bytes: number; url: string };

async function uploaded(response: Response): Promise<Uploaded> {
  expect(response.status).toBe(201);
  return response.json();
}

describe("Ideas attachment uploads", () => {
  it("stores an image in R2 under an owner-scoped key", async () => {
    const noteId = await createNote("添付テスト");
    const attachment = await uploaded(await upload(noteId, "pixel.png", "image/png", PNG));

    expect(attachment).toEqual(
      expect.objectContaining({ name: "pixel.png", content_type: "image/png", bytes: PNG.byteLength }),
    );
    expect(attachment.url).toBe(`/api/attachments/${attachment.id}`);
    expect(bucket.keys()).toEqual([expect.stringMatching(/^attachments\/local\/\d{6}\//)]);
  });

  it("serves an image inline with hardened headers", async () => {
    const noteId = await createNote("画像配信");
    const attachment = await uploaded(await upload(noteId, "pixel.png", "image/png", PNG));

    const served = await request(`/api/attachments/${attachment.id}`);
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/png");
    expect(served.headers.get("content-disposition")).toBe("inline");
    expect(served.headers.get("cache-control")).toBe("private, max-age=31536000, immutable");
    expect(served.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(PNG);
  });

  it("lists the note attachments in position order", async () => {
    const noteId = await createNote("一覧");
    const first = await uploaded(await upload(noteId, "a.png", "image/png", PNG));
    const second = await uploaded(await upload(noteId, "b.pdf", "application/pdf", PDF));

    const response = await request(`/api/ideas/notes/${noteId}/attachments`);
    expect(response.status).toBe(200);
    const listed: Uploaded[] = await response.json();
    expect(listed.map((item) => item.id)).toEqual([first.id, second.id]);
  });
});

describe("Ideas attachment inline display", () => {
  it("serves SVG inline", async () => {
    const noteId = await createNote("SVG");
    const svg = await uploaded(await upload(noteId, "graph.svg", "image/svg+xml", SVG));

    const response = await request(`/api/attachments/${svg.id}`);
    expect(response.headers.get("content-type")).toBe("image/svg+xml; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe("inline");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("sandboxes inline HTML with a CSP header", async () => {
    const noteId = await createNote("HTML");
    const html = await uploaded(await upload(noteId, "資料.html", "text/html", HTML));

    const response = await request(`/api/attachments/${html.id}`);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe("inline");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-security-policy")).toBe(
      "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:",
    );
  });

  it("downloads other files as an attachment with an escaped name", async () => {
    const noteId = await createNote("ダウンロード");
    const pdf = await uploaded(await upload(noteId, "調査 資料.pdf", "application/pdf", PDF));

    const response = await request(`/api/attachments/${pdf.id}`);
    expect(response.headers.get("content-disposition")).toContain("attachment;");
    expect(response.headers.get("content-disposition")).toContain(
      "filename*=UTF-8''%E8%AA%BF%E6%9F%BB%20%E8%B3%87%E6%96%99.pdf",
    );
  });

  it("forces a download when ?download=1 is set", async () => {
    const noteId = await createNote("強制DL");
    const image = await uploaded(await upload(noteId, "pixel.png", "image/png", PNG));

    const forced = await request(`/api/attachments/${image.id}?download=1`);
    expect(forced.headers.get("content-disposition")).toContain("attachment;");
  });
});

describe("Ideas attachment authorization", () => {
  it("rejects unauthenticated requests", async () => {
    const noteId = await createNote("認可");
    const attachment = await uploaded(await upload(noteId, "pixel.png", "image/png", PNG));

    const anonymous = await app.request(`/api/attachments/${attachment.id}`, {}, { SESSION_SECRET: SECRET });
    expect(anonymous.status).toBe(401);
  });

  it("rejects unknown notes and attachments", async () => {
    const form = new FormData();
    form.append("file", new File([new Uint8Array(PNG)], "pixel.png", { type: "image/png" }));

    expect((await request("/api/ideas/notes/missing/attachments", { method: "POST", body: form })).status).toBe(404);
    expect((await request("/api/attachments/missing")).status).toBe(404);
    expect((await request("/api/ideas/notes/missing/attachments")).status).toBe(404);
  });
});

describe("Ideas attachment validation", () => {
  it("rejects unsupported types and bytes that contradict the type", async () => {
    const noteId = await createNote("検証");

    const script = await upload(noteId, "run.js", "application/javascript", new TextEncoder().encode("alert(1)"));
    expect(script.status).toBe(400);
    expect(await script.json()).toEqual({ code: "UNSUPPORTED_ATTACHMENT" });

    const disguised = await upload(noteId, "fake.png", "image/png", new TextEncoder().encode("not an image"));
    expect(disguised.status).toBe(400);
    expect(await disguised.json()).toEqual({ code: "UNSUPPORTED_ATTACHMENT" });
  });

  it("rejects an empty or missing file field", async () => {
    const noteId = await createNote("空ファイル");

    expect((await upload(noteId, "empty.png", "image/png", new Uint8Array())).status).toBe(400);

    const noFile = await request(`/api/ideas/notes/${noteId}/attachments`, { method: "POST", body: new FormData() });
    expect(noFile.status).toBe(400);
    expect(await noFile.json()).toEqual({ code: "INVALID_ATTACHMENT" });
  });

  it("rejects files over the image and file size limits", async () => {
    const noteId = await createNote("サイズ");
    const bigImage = new Uint8Array(IDEA_ATTACHMENT_IMAGE_MAX_BYTES + 1);
    bigImage.set(PNG);
    const image = await upload(noteId, "big.png", "image/png", bigImage);
    expect(image.status).toBe(413);
    expect(await image.json()).toEqual({ code: "ATTACHMENT_TOO_LARGE" });

    const bigFile = new Uint8Array(IDEA_ATTACHMENT_FILE_MAX_BYTES + 1);
    bigFile.set(PDF);
    const file = await upload(noteId, "big.zip", "application/zip", bigFile);
    expect(file.status).toBe(413);
    expect(await file.json()).toEqual({ code: "ATTACHMENT_TOO_LARGE" });
  });
});

describe("Ideas attachment limits", () => {
  it("rejects an upload past the ten attachment limit", async () => {
    const noteId = await createNote("件数上限");
    for (let index = 0; index < IDEA_ATTACHMENT_MAX_COUNT; index += 1) {
      expect((await upload(noteId, `pixel-${index}.png`, "image/png", PNG)).status).toBe(201);
    }
    const overflow = await upload(noteId, "overflow.png", "image/png", PNG);
    expect(overflow.status).toBe(400);
    expect(await overflow.json()).toEqual({ code: "ATTACHMENT_LIMIT_EXCEEDED" });
  });

  it("rejects an upload past the 50MB per-note total", async () => {
    const noteId = await createNote("合計上限");
    for (const index of [1, 2]) {
      await repo.insertAttachment(fakeAttachment(`heavy-${index}`, noteId, index, 25 * 1024 * 1024));
    }
    const total = await upload(noteId, "pixel.png", "image/png", PNG);
    expect(total.status).toBe(400);
    expect(await total.json()).toEqual({ code: "ATTACHMENT_TOTAL_EXCEEDED" });
  });
});

function fakeAttachment(id: string, noteId: string, position: number, bytes: number): IdeaAttachment {
  return {
    id,
    owner_id: "local",
    note_id: noteId,
    position,
    kind: "file",
    name: `${id}.zip`,
    content_type: "application/zip",
    bytes,
    r2_key: `attachments/local/202611/${id}`,
    sha256: id,
    preview: "inline",
    created_at: "2026-11-01T00:00:00.000Z",
    deleted_at: null,
  };
}

describe("Ideas attachment management", () => {
  it("soft-deletes an attachment and stops serving it", async () => {
    const noteId = await createNote("削除");
    const attachment = await uploaded(await upload(noteId, "pixel.png", "image/png", PNG));

    expect((await request(`/api/ideas/attachments/${attachment.id}`, { method: "DELETE" })).status).toBe(204);
    expect((await request(`/api/attachments/${attachment.id}`)).status).toBe(404);
    expect(await (await request(`/api/ideas/notes/${noteId}/attachments`)).json()).toEqual([]);
    expect((await request(`/api/ideas/attachments/${attachment.id}`, { method: "DELETE" })).status).toBe(404);
  });

  it("persists the per-attachment preview mode", async () => {
    const noteId = await createNote("表示切替");
    const attachment = await uploaded(await upload(noteId, "pixel.png", "image/png", PNG));

    const patched = await request(`/api/ideas/attachments/${attachment.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ preview: "download" }),
    });
    expect(patched.status).toBe(200);
    expect(await patched.json()).toEqual(expect.objectContaining({ preview: "download" }));
    expect((await request(`/api/attachments/${attachment.id}`)).headers.get("content-disposition")).toContain(
      "attachment;",
    );

    const invalid = await request(`/api/ideas/attachments/${attachment.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ preview: "raw" }),
    });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ code: "INVALID_PREVIEW" });
  });

  it("fails with 503 when the attachments binding is missing", async () => {
    const noteId = await createNote("バケットなし");
    const cookie = await createSession(SECRET, Date.now() + 60_000);
    const form = new FormData();
    form.append("file", new File([new Uint8Array(PNG)], "pixel.png", { type: "image/png" }));
    const response = await app.request(
      `/api/ideas/notes/${noteId}/attachments`,
      { method: "POST", headers: { Cookie: `${SESSION_COOKIE_NAME}=${cookie}` }, body: form },
      { SESSION_SECRET: SECRET, IDEA_REPOSITORY: repo },
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: "ATTACHMENTS_UNAVAILABLE" });
  });
});

describe("Ideas inline image paste (BDD-TM-057)", () => {
  it("renders a body-referenced attachment inline instead of as a chip", async () => {
    const noteId = await createNote("インライン画像");
    const attachment = await uploaded(await upload(noteId, "pixel.png", "image/png", PNG));
    const patched = await request(`/api/ideas/notes/${noteId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: `前半![](${attachment.url})後半` }),
    });
    expect(patched.status).toBe(200);

    const html = await (await request("/ideas")).text();
    expect(html).toContain('class="idea-card__image"');
    expect(html).toContain(`src="${attachment.url}"`);
    // 本文が参照する添付は添付欄のチップに出さない。
    expect(html).not.toContain(`data-idea-attachment-id="${attachment.id}"`);
  });

  it("keeps the attachment chip when the body does not reference it", async () => {
    const noteId = await createNote("通常の添付");
    const attachment = await uploaded(await upload(noteId, "pixel.png", "image/png", PNG));

    const html = await (await request("/ideas")).text();
    expect(html).toContain(`data-idea-attachment-id="${attachment.id}"`);
  });
});
