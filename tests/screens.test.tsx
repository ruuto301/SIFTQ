import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import { SCREENS, htmlPageIds, pageEntities, screenByFile } from "../src/screens";
import { parseRoutes } from "../scripts/domain-model/extract";

function registeredPaths(): Set<string> {
  const dir = new URL("../src/routes/", import.meta.url);
  const paths = new Set<string>();
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".ts") && !name.endsWith(".tsx")) continue;
    const source = readFileSync(new URL(name, dir), "utf8");
    for (const route of parseRoutes(source)) paths.add(route.path);
  }
  return paths;
}

describe("screen registry", () => {
  it("registers a route for every screen path", () => {
    const paths = registeredPaths();
    for (const screen of SCREENS) {
      expect(paths, screen.path).toContain(screen.path);
    }
  });

  it("aggregates client files to presentation screens in screen order", () => {
    expect(screenByFile()).toEqual({
      "matrix-scripts.ts": ["P01"],
      "task-list-scripts.ts": ["P02"],
      "task-form-scripts.ts": ["P03", "P04"],
      "idea-scripts.ts": ["P08"],
    });
  });

  it("derives html page ids and entities from the registry", () => {
    expect(htmlPageIds()).toEqual({
      "/login": "html_login_page",
      "/matrix": "html_matrix_page",
      "/ideas": "html_ideas_page",
      "/ideas/:id": "html_ideas_detail",
      "/tasks": "html_tasks_page",
      "/tasks/new": "html_new_task_page",
      "/tasks/:id": "html_task_page",
    });
    expect(pageEntities()).toEqual({
      "/matrix": "tasks",
      "/ideas": "ideas",
      "/ideas/:id": "ideas",
      "/tasks": "tasks",
      "/tasks/:id": "tasks",
    });
  });
});
