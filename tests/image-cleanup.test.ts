import { describe, expect, it } from "vite-plus/test";
import { cleanupRemovedImages, descriptionImageTokens } from "../src/image-cleanup";
import { createMemoryImageRepository } from "../src/repository/image-repository";
import type { ImageRepository } from "../src/repository/image-repository";
import { createMemoryIdeaRepository } from "../src/preview/MemoryIdeaRepository";
import { createMemoryTaskRepository } from "../src/preview/MemoryTaskRepository";
import type { StoredImage } from "../src/image";

function imageFixture(id: string): StoredImage {
  return {
    id,
    owner_id: "local",
    content_type: "image/png",
    data: new Uint8Array([1]).buffer,
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

async function seedImage(repository: ImageRepository, id: string): Promise<void> {
  await repository.insert(imageFixture(id));
}

const TOKEN_A = "/api/images/image-a";
const TOKEN_B = "/api/images/image-b";

describe("descriptionImageTokens", () => {
  it("collects image tokens in order", () => {
    expect(descriptionImageTokens(`before ${TOKEN_A} middle ${TOKEN_B}`)).toEqual([TOKEN_A, TOKEN_B]);
    expect(descriptionImageTokens("no images")).toEqual([]);
  });
});

describe("cleanupRemovedImages", () => {
  it("deletes an image that disappeared and is unreferenced", async () => {
    const images = createMemoryImageRepository();
    const tasks = createMemoryTaskRepository();
    const ideas = createMemoryIdeaRepository();
    await seedImage(images, "image-a");

    const deleted = await cleanupRemovedImages(`text ${TOKEN_A} text`, "text only", { tasks, ideas, images });

    expect(deleted).toEqual(["image-a"]);
    expect(await images.find("image-a", "local")).toEqual({ ok: true, value: undefined });
  });

  it("keeps an image referenced by another task", async () => {
    const images = createMemoryImageRepository();
    const ideas = createMemoryIdeaRepository();
    await seedImage(images, "image-a");
    const other = createMemoryTaskRepository([
      {
        id: "task-1",
        owner_id: "local",
        title: "other",
        description: `keep ${TOKEN_A}`,
        status: "do",
        working: false,
        project: null,
        order: 1,
        version: 1,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const deleted = await cleanupRemovedImages(`${TOKEN_A}`, "", { tasks: other, ideas, images });

    expect(deleted).toEqual([]);
    expect(await images.find("image-a", "local")).not.toEqual({ ok: true, value: undefined });
  });

  it("keeps an image referenced by an idea", async () => {
    const images = createMemoryImageRepository();
    const tasks = createMemoryTaskRepository();
    await seedImage(images, "image-a");
    const other = createMemoryIdeaRepository([
      { id: "idea-1", owner_id: "local", title: "idea", description: `keep ${TOKEN_A}`, order: 1, pinned: false },
    ]);

    const deleted = await cleanupRemovedImages(`${TOKEN_A}`, "", { tasks, ideas: other, images });

    expect(deleted).toEqual([]);
  });

  it("keeps an image that is still in the description", async () => {
    const images = createMemoryImageRepository();
    const tasks = createMemoryTaskRepository();
    const ideas = createMemoryIdeaRepository();
    await seedImage(images, "image-a");

    const deleted = await cleanupRemovedImages(`a ${TOKEN_A}`, `b ${TOKEN_A}`, { tasks, ideas, images });

    expect(deleted).toEqual([]);
  });
});
