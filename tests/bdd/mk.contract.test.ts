import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import app from "../../src/index";
import { SESSION_COOKIE_NAME, createSession } from "../../src/auth";
import { createMemoryMkRepository } from "../../src/preview/MemoryMkRepository";
import { createMemoryImageRepository } from "../../src/repository/image-repository";
import { MK_MAX_IMAGES, isMkNote } from "../../src/mk";
import type { MkNote } from "../../src/mk";
import type { MkRepository } from "../../src/repository/mk-repository";
import type { ImageRepository } from "../../src/repository/image-repository";

const SECRET = "mk-contract-secret";

let repo: MkRepository;
let images: ImageRepository;

beforeEach(() => {
  repo = createMemoryMkRepository();
  images = createMemoryImageRepository();
});

async function request(path: string, init: RequestInit = {}) {
  const cookie = await createSession(SECRET, Date.now() + 60_000);
  const headers = new Headers(init.headers);
  headers.set("Cookie", `${SESSION_COOKIE_NAME}=${cookie}`);
  return app.request(path, { ...init, headers }, { SESSION_SECRET: SECRET, MK_REPOSITORY: repo, IMAGE_REPOSITORY: images });
}

function jsonRequest(path: string, method: string, body: unknown) {
  return request(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

function uploadImage() {
  const form = new FormData();
  form.append("file", new File([new Uint8Array([137, 80, 78, 71])], "pixel.png", { type: "image/png" }));
  return request("/api/images", { method: "POST", body: form });
}

async function readNote(response: Response): Promise<MkNote> {
  const value: unknown = await response.json();
  if (!isMkNote(value)) throw new Error("expected an MK note");
  return value;
}

async function readNotes(response: Response): Promise<MkNote[]> {
  const value: unknown = await response.json();
  if (!Array.isArray(value)) throw new Error("expected MK notes");
  return value.filter(isMkNote);
}

async function createNote(title: string, body = "", color = "default"): Promise<MkNote> {
  const response = await jsonRequest("/api/mk/notes", "POST", { title, body, color });
  expect(response.status).toBe(201);
  return readNote(response);
}

async function bulk(action: string, ids: readonly string[]) {
  return jsonRequest("/api/mk/notes/bulk", "POST", { ids, action });
}

describe("MK notes API", () => {
  it("creates, lists, updates, and deletes a note", async () => {
    const created = await createNote("買い物", "牛乳", "blue");
    expect(created).toEqual(expect.objectContaining({ title: "買い物", body: "牛乳", color: "blue", pinned: false }));

    const patched = await jsonRequest(`/api/mk/notes/${created.id}`, "PATCH", { title: "買い物2", pinned: true });
    expect(patched.status).toBe(200);
    expect(await readNote(patched)).toEqual(
      expect.objectContaining({ id: created.id, title: "買い物2", pinned: true, color: "blue" }),
    );

    expect(await readNotes(await request("/api/mk/notes"))).toEqual([
      expect.objectContaining({ id: created.id, pinned: true }),
    ]);

    expect((await request(`/api/mk/notes/${created.id}`, { method: "DELETE" })).status).toBe(204);
    expect(await readNotes(await request("/api/mk/notes"))).toEqual([]);
  });

  it("rejects invalid input", async () => {
    expect((await jsonRequest("/api/mk/notes", "POST", { title: "" })).status).toBe(400);
    expect((await jsonRequest("/api/mk/notes", "POST", { title: "ok", color: "cyan" })).status).toBe(400);
    expect((await jsonRequest("/api/mk/notes/missing", "PATCH", { title: "x" })).status).toBe(404);
    expect((await request("/api/mk/notes?filter=unknown")).status).toBe(400);
  });

  it("filters by pin state, color, and text", async () => {
    const alpha = await createNote("Alpha", "first", "blue");
    const beta = await createNote("Beta", "second", "red");
    await jsonRequest(`/api/mk/notes/${beta.id}`, "PATCH", { pinned: true });

    expect((await readNotes(await request("/api/mk/notes?filter=pinned"))).map((note) => note.id)).toEqual([beta.id]);
    expect((await readNotes(await request("/api/mk/notes?filter=unpinned"))).map((note) => note.id)).toEqual([alpha.id]);
    expect((await readNotes(await request("/api/mk/notes?color=red"))).map((note) => note.id)).toEqual([beta.id]);
    expect((await readNotes(await request("/api/mk/notes?q=second"))).map((note) => note.id)).toEqual([beta.id]);
  });
});

describe("MK notes bulk API", () => {
  it("changes color, pins, and deletes selected notes", async () => {
    const first = await createNote("one");
    const second = await createNote("two");

    const recolored = await jsonRequest("/api/mk/notes/bulk", "POST", {
      ids: [first.id, second.id],
      action: "color",
      color: "green",
    });
    expect(recolored.status).toBe(200);
    expect((await readNotes(recolored)).map((note) => note.color)).toEqual(["green", "green"]);

    const pinned = await jsonRequest("/api/mk/notes/bulk", "POST", { ids: [first.id], action: "pin", pinned: true });
    expect(pinned.status).toBe(200);
    expect(await readNotes(pinned)).toEqual([expect.objectContaining({ id: first.id, pinned: true })]);

    const removed = await jsonRequest("/api/mk/notes/bulk", "POST", { ids: [first.id, second.id], action: "delete" });
    expect(removed.status).toBe(204);
    expect(await readNotes(await request("/api/mk/notes"))).toEqual([]);
  });

  it("rejects an invalid bulk payload", async () => {
    const note = await createNote("one");

    expect((await jsonRequest("/api/mk/notes/bulk", "POST", { ids: [], action: "delete" })).status).toBe(400);
    expect((await jsonRequest("/api/mk/notes/bulk", "POST", { ids: [note.id], action: "color", color: "cyan" })).status).toBe(400);
    expect((await jsonRequest("/api/mk/notes/bulk", "POST", { ids: ["missing"], action: "delete" })).status).toBe(404);
  });
});

describe("MK archive and trash API", () => {
  it("archives and restores notes", async () => {
    const kept = await createNote("残す");
    const archived = await createNote("しまう");

    const result = await bulk("archive", [archived.id]);
    expect(result.status).toBe(200);
    expect(await readNotes(result)).toEqual([
      expect.objectContaining({ id: archived.id, archived_at: expect.any(String) }),
    ]);

    expect((await readNotes(await request("/api/mk/notes"))).map((note) => note.id)).toEqual([kept.id]);
    expect((await readNotes(await request("/api/mk/notes?filter=archived"))).map((note) => note.id)).toEqual([archived.id]);

    const restored = await bulk("unarchive", [archived.id]);
    expect(restored.status).toBe(200);
    expect(await readNotes(restored)).toEqual([expect.objectContaining({ id: archived.id, archived_at: null })]);
    expect((await readNotes(await request("/api/mk/notes"))).map((note) => note.id).sort()).toEqual([kept.id, archived.id].sort());

    expect((await bulk("archive", ["missing"])).status).toBe(404);
  });

  it("trashes, restores, and purges notes with their image links", async () => {
    const note = await createNote("ゴミ箱へ");
    const uploaded = await uploadImage();
    const image: { id: string } = await uploaded.json();
    const link: { id: string } = await (await jsonRequest(`/api/mk/notes/${note.id}/images`, "POST", { imageId: image.id })).json();

    const trashed = await bulk("trash", [note.id]);
    expect(trashed.status).toBe(200);
    expect(await readNotes(trashed)).toEqual([expect.objectContaining({ id: note.id, deleted_at: expect.any(String) })]);
    expect(await readNotes(await request("/api/mk/notes"))).toEqual([]);
    expect((await readNotes(await request("/api/mk/notes?filter=trash"))).map((item) => item.id)).toEqual([note.id]);

    const restored = await bulk("restore", [note.id]);
    expect(restored.status).toBe(200);
    expect(await readNotes(restored)).toEqual([expect.objectContaining({ id: note.id, deleted_at: null })]);
    await bulk("trash", [note.id]);

    const active = await createNote("まだ生きている");
    expect((await bulk("purge", [active.id])).status).toBe(409);

    expect((await bulk("purge", [note.id])).status).toBe(204);
    expect(await readNotes(await request("/api/mk/notes?filter=trash"))).toEqual([]);
    expect((await jsonRequest(`/api/mk/notes/${note.id}`, "PATCH", { title: "x" })).status).toBe(404);
    expect((await request(`/api/mk/images/${link.id}`, { method: "DELETE" })).status).toBe(404);
    expect((await request(`/api/images/${image.id}`)).status).toBe(200);
  });

  it("counts notes per view", async () => {
    await createNote("active");
    const archived = await createNote("archived");
    const trashed = await createNote("trashed");
    await bulk("archive", [archived.id]);
    await bulk("trash", [trashed.id]);
    const counts = await repo.counts("local");
    expect(counts.ok).toBe(true);
    if (!counts.ok) return;
    expect(counts.value).toEqual({ notes: 1, pinned: 0, unpinned: 1, archived: 1, trash: 1 });
  });
});

describe("MK page", () => {
  it("renders cards, color classes, sidebar counts, and the MK nav", async () => {
    const note = await createNote("ページ表示", "本文", "purple");
    await jsonRequest(`/api/mk/notes/${note.id}`, "PATCH", { pinned: true });

    const response = await request("/mk");
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain(`data-mk-id="${note.id}"`);
    expect(body).toContain("mk-card mk-card--purple");
    expect(body).toContain("ページ表示");
    expect(body).toContain("アーカイブ");
    expect(body).toContain("ゴミ箱");
    expect(body).toContain('data-mk-count="notes"');
    expect(body).toContain('data-mk-count="archived"');
    expect(body).toContain('data-mk-count="trash"');
    expect(body).toContain('src="/mk.js"');
    expect(body).toContain(">MK<");
  });

  it("filters the rendered cards through query params", async () => {
    await createNote("Alpha", "hidden", "blue");
    await createNote("Beta", "shown", "red");

    const body = await (await request("/mk?q=shown")).text();

    expect(body).toContain("Beta");
    expect(body).not.toContain("Alpha");
  });
});

describe("MK client script", () => {
  it("serves /mk.js with the note endpoints", async () => {
    const response = await request("/mk.js");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/javascript");
    const body = await response.text();
    expect(body).toContain("/api/mk/notes");
    expect(body).toContain("/api/mk/notes/bulk");
    expect(body).toContain("/api/mk/images/");
    expect(body).toContain("/api/images");
  });
});

describe("MK note images API", () => {
  async function noteId(title = "画像メモ"): Promise<string> {
    return (await createNote(title)).id;
  }

  async function linkImage(note: string, imageId: string) {
    return jsonRequest(`/api/mk/notes/${note}/images`, "POST", { imageId });
  }

  it("uploads an image, links it, renders the thumbnail, and unlinks it", async () => {
    const id = await noteId();
    const uploaded = await uploadImage();
    expect(uploaded.status).toBe(201);
    const image: { id: string; url: string } = await uploaded.json();

    const linked = await linkImage(id, image.id);
    expect(linked.status).toBe(201);
    const link: { id: string; url: string } = await linked.json();
    expect(link.url).toBe(`/api/images/${image.id}`);

    const rendered = await (await request("/mk")).text();
    expect(rendered).toContain("mk-card__image");
    expect(rendered).toContain(`/api/images/${image.id}`);
    expect(rendered).toContain(`data-mk-image-remove="${link.id}"`);

    expect((await request(`/api/mk/images/${link.id}`, { method: "DELETE" })).status).toBe(204);
    const afterRemoval = await (await request("/mk")).text();
    expect(afterRemoval).not.toContain(`/api/images/${image.id}`);
    // The stored blob survives unlinking.
    expect((await request(`/api/images/${image.id}`)).status).toBe(200);
    expect((await request(`/api/mk/images/${link.id}`, { method: "DELETE" })).status).toBe(404);
  });

  it("rejects unknown notes, unknown images, and missing image ids", async () => {
    const id = await noteId();

    expect((await linkImage("missing", "image-1")).status).toBe(404);
    expect((await linkImage(id, "missing")).status).toBe(400);
    expect((await linkImage(id, "")).status).toBe(400);
    expect((await jsonRequest(`/api/mk/notes/${id}/images`, "POST", {})).status).toBe(400);
    expect((await request(`/api/mk/notes/${id}/images`, { method: "POST", body: "not json" })).status).toBe(400);
  });

  it("rejects an attachment beyond the ten image limit", async () => {
    const id = await noteId();
    const uploaded = await uploadImage();
    const image: { id: string } = await uploaded.json();

    for (let index = 0; index < MK_MAX_IMAGES; index += 1) {
      expect((await linkImage(id, image.id)).status).toBe(201);
    }

    const overflow = await linkImage(id, image.id);
    expect(overflow.status).toBe(400);
    expect(await overflow.json()).toEqual({ code: "IMAGE_LIMIT_EXCEEDED" });
  });

  it("keeps positions increasing after an unlink", async () => {
    const id = await noteId();
    const first: { id: string } = await (await uploadImage()).json();
    const second: { id: string } = await (await uploadImage()).json();

    const firstLink: { id: string } = await (await linkImage(id, first.id)).json();
    await linkImage(id, second.id);
    await request(`/api/mk/images/${firstLink.id}`, { method: "DELETE" });

    const relinked = await linkImage(id, first.id);
    expect(relinked.status).toBe(201);

    const rendered = await (await request("/mk")).text();
    expect(rendered).toContain(`/api/images/${second.id}`);
  });
});

describe("MK screen follows the agreed mock (BDD-TM-037)", () => {
  it("renders the seven color filters without an all-colors chip", async () => {
    const html = await (await request("/mk")).text();

    for (const color of ["default", "red", "orange", "yellow", "green", "blue", "purple"]) {
      expect(html).toContain(`data-mk-color-filter="${color}"`);
    }
    expect(html).not.toContain('data-mk-color-filter="all"');
    expect(html).not.toContain("mk-color-filter__dot--all");
  });

  it("lets the active color clear the filter instead of adding an all-colors chip", async () => {
    const html = await (await request("/mk?color=red")).text();

    // The active swatch links back to the unfiltered list.
    expect(html).toContain('href="/mk?filter=notes" data-mk-color-filter="red"');
    expect(html).toContain('aria-label="red の絞り込みを解除"');
  });

  it("renders the Keep-style composer and search wording", async () => {
    const html = await (await request("/mk")).text();

    // Keep puts a single "take a note" card at the top of the list.
    expect(html).toContain("メモを取る...");
    expect(html).not.toContain("data-mk-side-new");
    expect(html).toContain('placeholder="メモを検索（タイトル / 本文）"');
    expect(html).toContain('placeholder="新しいメモのタイトル"');
    expect(html).toContain("Ctrl+V で画像を貼り付け");
  });

  it("shows the search clear control only when a query is present", async () => {
    expect(await (await request("/mk")).text()).not.toContain("data-mk-search-clear");

    const filtered = await (await request("/mk?q=memo")).text();
    expect(filtered).toContain("data-mk-search-clear");
    expect(filtered).toContain('value="memo"');
  });
});

describe("MK date range and sort API", () => {
  it("filters by the created date range with inclusive bounds", async () => {
    const first = await createNote("古いメモ");
    const second = await createNote("新しいメモ");
    const both = [first.id, second.id].sort();

    const future = "2999-01-01";
    const past = "2000-01-01";

    expect((await readNotes(await request(`/api/mk/notes?dateKind=created&from=${past}`))).map((note) => note.id).sort()).toEqual(both);
    expect(await readNotes(await request(`/api/mk/notes?dateKind=created&from=${future}`))).toEqual([]);
    expect(await readNotes(await request(`/api/mk/notes?dateKind=created&to=${past}`))).toEqual([]);
    expect((await readNotes(await request(`/api/mk/notes?dateKind=created&to=${future}`)))).toHaveLength(2);
  });

  it("filters by the updated date range", async () => {
    const note = await createNote("更新対象");
    await jsonRequest(`/api/mk/notes/${note.id}`, "PATCH", { title: "更新済み" });

    expect((await readNotes(await request("/api/mk/notes?dateKind=updated&from=2000-01-01"))).map((item) => item.id)).toEqual([
      note.id,
    ]);
    expect(await readNotes(await request("/api/mk/notes?dateKind=updated&from=2999-01-01"))).toEqual([]);
  });

  it("rejects malformed date and sort values", async () => {
    expect((await request("/api/mk/notes?from=not-a-date")).status).toBe(400);
    expect((await request("/api/mk/notes?dateKind=deleted")).status).toBe(400);
    expect((await request("/api/mk/notes?sort=updated:sideways")).status).toBe(400);
    expect((await request("/api/mk/notes?sort=deleted:asc")).status).toBe(400);
    expect((await request("/api/mk/notes?sort=created:asc")).status).toBe(200);
  });

  it("orders notes by the requested field and direction", async () => {
    await createNote("A");
    const middle = await createNote("B");
    await jsonRequest(`/api/mk/notes/${middle.id}`, "PATCH", { title: "B 更新" });
    await createNote("C");

    const readTimes = async (sort: string, field: "created_at" | "updated_at") =>
      (await readNotes(await request(`/api/mk/notes?sort=${sort}`))).map((note) => note[field]);

    const ascending = await readTimes("updated:asc", "updated_at");
    expect(ascending).toEqual([...ascending].sort());
    const descending = await readTimes("updated:desc", "updated_at");
    expect(descending).toEqual([...descending].sort().reverse());
    const created = await readTimes("created:asc", "created_at");
    expect(created).toEqual([...created].sort());
  });
});

describe("MK link preview API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubPreviewFetch(body: string): void {
    vi.stubGlobal(
      "fetch",
      async () => new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }),
    );
  }

  it("fetches and stores the metadata of the first note URL", async () => {
    const note = await createNote("リンク", "参考 https://example.com/post");
    stubPreviewFetch(
      `<meta property="og:title" content="Example post"><meta property="og:description" content="説明"><meta property="og:image" content="https://cdn.example.com/a.png">`,
    );

    const response = await request(`/api/mk/notes/${note.id}/preview`, { method: "POST" });
    expect(response.status).toBe(200);
    expect(await readNote(response)).toEqual(
      expect.objectContaining({
        id: note.id,
        preview_title: "Example post",
        preview_description: "説明",
        preview_image: "https://cdn.example.com/a.png",
        preview_domain: "example.com",
      }),
    );

    const rendered = await (await request("/mk")).text();
    expect(rendered).toContain("data-mk-preview");
    expect(rendered).toContain("data-mk-link");
  });

  it("rejects a note without a URL and a note with a local URL", async () => {
    const plain = await createNote("URL なし", "本文だけ");
    expect((await request(`/api/mk/notes/${plain.id}/preview`, { method: "POST" })).status).toBe(400);

    const local = await createNote("ローカル", "http://127.0.0.1/secret");
    expect((await request(`/api/mk/notes/${local.id}/preview`, { method: "POST" })).status).toBe(400);
    expect((await request("/api/mk/notes/missing/preview", { method: "POST" })).status).toBe(404);
  });

  it("records nothing when the fetch fails", async () => {
    const note = await createNote("失敗", "https://example.com/down");
    vi.stubGlobal("fetch", async () => {
      throw new Error("down");
    });

    expect((await request(`/api/mk/notes/${note.id}/preview`, { method: "POST" })).status).toBe(502);
    const listed = await readNotes(await request("/api/mk/notes"));
    expect(listed[0]?.preview_fetched_at).toBeNull();
    expect(listed[0]?.preview_title).toBeNull();
  });
});

describe("MK phase 3 screen controls", () => {
  it("keeps the date range, sort and saved search inside the filter menu", async () => {
    const html = await (await request("/mk")).text();

    expect(html).toContain("data-mk-filter-menu");
    expect(html).toContain("data-mk-date-form");
    expect(html).toContain("data-mk-date-kind");
    expect(html).toContain("data-mk-sort-field");
    expect(html).toContain("data-mk-saved-searches");
    expect(html).not.toContain("data-mk-theme");
    expect(html).toContain('data-mk-sort="updated:desc"');
  });

  it("shows the active date range with its clear control", async () => {
    const html = await (await request("/mk?dateKind=updated&from=2026-01-01&to=2026-01-31")).text();

    expect(html).toContain("data-mk-date-active");
    expect(html).toContain("data-mk-date-clear");
    expect(html).toContain("2026-01-01");
  });

  it("keeps the sort parameter in the sidebar links", async () => {
    const html = await (await request("/mk?sort=created:asc")).text();

    expect(html).toContain("sort=created%3Aasc");
  });

  it("serves the phase 3 client hooks in /mk.js", async () => {
    const body = await (await request("/mk.js")).text();

    expect(body).toContain("/preview");
    expect(body).toContain("mk-saved-searches:v1");
    expect(body).not.toContain("mk-theme:v1");
    expect(body).toContain("data-mk-date-form");
    expect(body).toContain("data-mk-detail");
  });
});

describe("MK detail dialog (BDD-TM-044)", () => {
  it("renders the Keep-style detail dialog with every editable control", async () => {
    const html = await (await request("/mk")).text();

    expect(html).toContain("data-mk-detail");
    expect(html).toContain("data-mk-detail-dialog");
    expect(html).toContain("data-mk-detail-title");
    expect(html).toContain("data-mk-detail-body");
    expect(html).toContain("data-mk-detail-pin");
    expect(html).toContain("data-mk-detail-color=");
    expect(html).toContain("data-mk-detail-archive");
    expect(html).toContain("data-mk-detail-trash");
    expect(html).toContain("data-mk-detail-delete");
    expect(html).toContain("data-mk-detail-close");
  });

  it("gives each card the data the dialog needs to open", async () => {
    const note = await createNote("ダイアログ用", "本文です", "green");
    const html = await (await request("/mk")).text();

    expect(html).toContain(`data-mk-id="${note.id}"`);
    expect(html).toContain('data-mk-open');
    expect(html).toContain('data-mk-title="ダイアログ用"');
    expect(html).toContain('data-mk-body="本文です"');
    expect(html).toContain("data-mk-images=");
  });

  it("drops the theme switch and keeps the memo colours fixed", async () => {
    const html = await (await request("/mk")).text();
    const css = await (await request("/styles.css")).text();

    expect(html).not.toContain("data-mk-theme");
    expect(css).not.toContain('html[data-theme="dark"]');
    expect(css).toMatch(/\.mk-card--default\s*\{\s*background: #2c2e31;/);
    expect(css).toMatch(/\.mk-card--blue\s*\{\s*background: #2c4059;/);
  });
});

describe("MK toolbar without bulk selection (BDD-TM-045)", () => {
  it("renders no selection toggle or card checkboxes", async () => {
    const note = await createNote("選択なし", "", "default");
    const html = await (await request("/mk")).text();

    expect(html).toContain(`data-mk-id="${note.id}"`);
    expect(html).not.toContain("data-mk-selection-toggle");
    expect(html).not.toContain("data-mk-select=");
    expect(html).not.toContain("data-mk-bulk-bar");
  });
});

describe("MK without labels (BDD-TM-047)", () => {
  it("renders no label UI on the screen", async () => {
    const note = await createNote("ラベルなし");
    const html = await (await request("/mk")).text();

    expect(html).toContain(`data-mk-id="${note.id}"`);
    expect(html).not.toContain("mk-label-manager");
    expect(html).not.toContain("data-mk-card-label");
    expect(html).not.toContain("data-mk-detail-label-add");
    expect(html).not.toContain("data-mk-composer-labels");
    expect(html).not.toContain("新しいラベル");
  });

  it("returns 404 for every label endpoint", async () => {
    expect((await request("/api/mk/labels")).status).toBe(404);
    expect((await jsonRequest("/api/mk/labels", "POST", { name: "x" })).status).toBe(404);
    expect((await jsonRequest("/api/mk/labels/l1", "PATCH", { name: "x" })).status).toBe(404);
    expect((await request("/api/mk/labels/l1", { method: "DELETE" })).status).toBe(404);
    const note = await createNote("ラベル API なし");
    expect((await jsonRequest(`/api/mk/notes/${note.id}/labels`, "POST", { labelIds: [] })).status).toBe(404);
  });
});

describe("MK maximum width (BDD-TM-050)", () => {
  it("caps the page width and wraps the cards", async () => {
    const css = await (await request("/styles.css")).text();

    expect(css).toMatch(/\.page--mk\s*\{[^}]*max-width: 1400px/);
    expect(css).toMatch(/\.mk-grid\s*\{[^}]*grid-template-columns: repeat\(auto-fill, minmax\(220px, 1fr\)\)/);
    expect(css).not.toContain("columns: 3;");
    expect(css).not.toContain("columns: 4;");
  });
});
