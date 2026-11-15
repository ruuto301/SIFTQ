import { describe, expect, it } from "vite-plus/test";
import { createMemoryProjectRepository } from "../src/preview/MemoryProjectRepository";
import type { Project } from "../src/project";

const PROJECTS: readonly Project[] = [
  { id: "z", name: "Z", sort_order: 3 },
  { id: "a", name: "A", sort_order: 1 },
  { id: "m", name: "M", sort_order: 2 },
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

describe("MemoryProjectRepository writes", () => {
  it("inserts a new project and rejects a duplicated id", async () => {
    const repository = createMemoryProjectRepository(PROJECTS);
    const created: Project = { id: "b", name: "B", sort_order: 4 };

    expect(await repository.insert(created)).toEqual({ ok: true, value: created });
    expect(await repository.insert(created)).toEqual({ ok: false, error: { code: "CONFLICT" } });
    expect(await repository.find("b")).toEqual({ ok: true, value: created });
  });

  it("updates a stored project and reports an unknown id", async () => {
    const repository = createMemoryProjectRepository(PROJECTS);
    const renamed: Project = { id: "a", name: "A2", sort_order: 1 };

    expect(await repository.update(renamed)).toEqual({ ok: true, value: renamed });
    expect(await repository.find("a")).toEqual({ ok: true, value: renamed });
    expect(await repository.update({ ...renamed, id: "missing" })).toEqual({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });

  it("removes a stored project and reports an unknown id", async () => {
    const repository = createMemoryProjectRepository(PROJECTS);

    expect(await repository.remove("m")).toEqual({ ok: true, value: null });
    expect(await repository.find("m")).toEqual({ ok: true, value: undefined });
    expect(await repository.remove("missing")).toEqual({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });
});
