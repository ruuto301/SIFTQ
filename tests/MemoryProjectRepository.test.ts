import { describe, expect, it } from "vite-plus/test";
import { createMemoryProjectRepository } from "../src/preview/MemoryProjectRepository";
import type { Project } from "../src/project";

const PROJECTS: readonly Project[] = [
  { id: "z", name: "Z", path: null, sort_order: 3, archived: true },
  { id: "a", name: "A", path: "/workspace/a", sort_order: 1, archived: false },
  { id: "m", name: "M", path: null, sort_order: 2, archived: false },
];

describe("MemoryProjectRepository", () => {
  it("sorts by sort_order regardless of insertion order", async () => {
    const repository = createMemoryProjectRepository(PROJECTS);

    const listed = await repository.list();

    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.map((project) => project.id)).toEqual(["a", "m", "z"]);
  });

  it("keeps the seeded values intact", async () => {
    const repository = createMemoryProjectRepository(PROJECTS);

    const found = await repository.find("a");

    expect(found).toEqual({ ok: true, value: PROJECTS[1] });
  });

  it("returns undefined for an unknown project", async () => {
    const repository = createMemoryProjectRepository(PROJECTS);

    expect(await repository.find("missing")).toEqual({ ok: true, value: undefined });
  });
});
