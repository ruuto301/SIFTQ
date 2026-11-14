import { describe, expect, it } from "vite-plus/test";
import type { D1Database } from "@cloudflare/workers-types";
import { createMemoryProjectRepository } from "../src/preview/MemoryProjectRepository";
import { createD1ProjectRepository } from "../src/repository/d1-project-repository";
import type { Project } from "../src/project";

const PROJECTS: readonly Project[] = [
  { id: "b", name: "B", path: null, sort_order: 2, archived: false },
  { id: "a", name: "A", path: "/workspace/a", sort_order: 1, archived: false },
];

const unusedD1Database = {
  prepare() {
    throw new Error("D1 is not used by this factory contract test.");
  },
  batch() {
    throw new Error("D1 is not used by this factory contract test.");
  },
  exec() {
    throw new Error("D1 is not used by this factory contract test.");
  },
  withSession() {
    throw new Error("D1 is not used by this factory contract test.");
  },
  dump() {
    throw new Error("D1 is not used by this factory contract test.");
  },
} satisfies D1Database;

describe("ProjectRepository contract", () => {
  it("lists projects in sort order", async () => {
    const repository = createMemoryProjectRepository(PROJECTS);

    const listed = await repository.list();

    expect(listed).toEqual({ ok: true, value: [PROJECTS[1], PROJECTS[0]] });
  });

  it("finds a project or returns undefined", async () => {
    const repository = createMemoryProjectRepository(PROJECTS);

    const found = await repository.find("a");
    const missing = await repository.find("missing");

    expect(found).toEqual({ ok: true, value: PROJECTS[1] });
    expect(missing).toEqual({ ok: true, value: undefined });
  });

  it("exposes the same contract from both repository factories", () => {
    const repositories = [
      createMemoryProjectRepository(PROJECTS),
      createD1ProjectRepository(unusedD1Database),
    ];
    for (const repository of repositories) {
      expect(Object.keys(repository).sort()).toEqual(["find", "insert", "list", "move", "update"]);
    }
  });
});
