import { describe, expect, it } from "vite-plus/test";
import { PREVIEW_PROJECTS } from "../src/preview/projects";
import { sortProjects } from "../src/project";

describe("PREVIEW_PROJECTS", () => {
  it("seeds the initial projects in sort order", () => {
    expect(PREVIEW_PROJECTS.map((project) => project.id)).toEqual([
      "Yoriwake",
      "affiliate",
      "customer_portal",
      "life",
    ]);
    expect(sortProjects(PREVIEW_PROJECTS).map((project) => project.sort_order)).toEqual([1, 2, 3, 4]);
  });

  it("keeps every seed project id valid", () => {
    for (const project of PREVIEW_PROJECTS) {
      expect(project.id).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
      expect(project.name.length).toBeGreaterThan(0);
    }
  });
});
