import { beforeEach, describe, expect, it } from "vite-plus/test";
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
    expect(body).toContain("ピンあり");
    expect(body).toContain("ピンなし");
    expect(body).toContain('data-mk-count="all"');
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
