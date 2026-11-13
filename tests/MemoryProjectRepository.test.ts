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

  it("reorders projects and returns the updated list", async () => {
    const repository = createMemoryProjectRepository(PROJECTS);

    const moved = await repository.move([
      { id: "a", order: 3 },
      { id: "m", order: 1 },
      { id: "z", order: 2 },
    ]);

    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(moved.value.map((project) => [project.id, project.sort_order])).toEqual([
      ["m", 1],
      ["z", 2],
      ["a", 3],
    ]);
    const listed = await repository.list();
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.map((project) => project.id)).toEqual(["m", "z", "a"]);
  });

  it("rejects an unknown project without changing any order", async () => {
    const repository = createMemoryProjectRepository(PROJECTS);

    const moved = await repository.move([
      { id: "a", order: 1 },
      { id: "missing", order: 2 },
    ]);

    expect(moved).toEqual({ ok: false, error: { code: "INVALID_PROJECT" } });
    const listed = await repository.list();
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.map((project) => project.id)).toEqual(["a", "m", "z"]);
  });
});
