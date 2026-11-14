import { describe, expect, it } from "vite-plus/test";
import { buildAuto, extractClientCalls, parseRoutes, routeToApi } from "./extract";

describe("domain extractor", () => {
  it("derives api ids, operations, entities and success codes from routes", () => {
    expect(routeToApi({ method: "GET", path: "/api/tasks" })).toEqual({
      id: "tasks_list",
      operation: { kind: "api", method: "GET", path: "/api/tasks", operation: "list", success: 200, entity: "tasks" },
    });
    expect(routeToApi({ method: "PATCH", path: "/api/tasks/bulk/status" })?.id).toBe("tasks_bulk_status");
    expect(routeToApi({ method: "DELETE", path: "/api/tasks/bulk" })?.id).toBe("tasks_bulk_delete");
    expect(routeToApi({ method: "GET", path: "/api/images/:id" })?.operation).toEqual({
      kind: "api",
      method: "GET",
      path: "/api/images/{id}",
      operation: "get",
      success: 200,
    });
    expect(routeToApi({ method: "POST", path: "/login" })?.operation).toEqual({
      kind: "html",
      method: "POST",
      path: "/login",
      operation: "login",
      success: 302,
    });
    expect(routeToApi({ method: "GET", path: "/tasks/:id" })?.id).toBe("html_task_page");
  });

  it("filters redirects and fragment routes and merges error metadata", () => {
    const routes = parseRoutes(`app.get("/", (c) => c.redirect("/ideas"));\napp.get("/tasks/:id/status/menu", h);\napp.get("/api/tasks", h);`);
    const auto = buildAuto(routes, [], { tasks_list: { errors: [{ status: 500 }] } });
    expect(Object.keys(auto.api ?? {})).toEqual(["tasks_list"]);
    expect(auto.api?.["tasks_list"]?.errors).toEqual([{ status: 500 }]);
  });

  it("disambiguates api ids that a nested collection path shares across methods", () => {
    const routes = parseRoutes(
      `app.get("/api/mk/notes", h);\napp.post("/api/mk/notes", h);\napp.post("/api/mk/notes/bulk", h);\napp.patch("/api/mk/notes/:id", h);\napp.delete("/api/mk/notes/:id", h);`,
    );
    const auto = buildAuto(routes, [], { mk_notes_post: { errors: [{ status: 400, code: "INVALID_TITLE" }] } });

    expect(Object.keys(auto.api ?? {})).toEqual([
      "mk_notes",
      "mk_notes_post",
      "mk_notes_bulk",
      "mk_notes_id",
      "mk_notes_id_delete",
    ]);
    expect(auto.api?.["mk_notes_post"]?.errors).toEqual([{ status: 400, code: "INVALID_TITLE" }]);
  });

});

describe("domain extractor client calls", () => {
  it("extracts calls from escaped client sources including ternaries", () => {
    const escaped = `  "  fetch(\\"/api/tasks/\\" + encodeURIComponent(id), {",\n  "    method: \\"PATCH\\",",`;
    expect(extractClientCalls(escaped)).toEqual([{ method: "PATCH", path: "/api/tasks/{id}" }]);
    const ternary = `    const request = fetch(isDelete ? "/api/tasks/bulk" : "/api/tasks/bulk/status", {\n      method: isDelete ? "DELETE" : "PATCH",`;
    expect(extractClientCalls(ternary)).toEqual([
      { method: "DELETE", path: "/api/tasks/bulk" },
      { method: "PATCH", path: "/api/tasks/bulk/status" },
    ]);
  });

  it("maps client calls to screens with api ids", () => {
    const routes = parseRoutes(`app.post("/api/ideas", h);\napp.post("/api/ideas/reorder", h);`);
    const calls = [
      { file: "idea-scripts.ts", method: "POST", path: "/api/ideas" },
      { file: "idea-scripts.ts", method: "POST", path: "/api/ideas/reorder" },
    ];
    const auto = buildAuto(routes, calls, {});
    expect(auto.screenCalls).toEqual([
      { screen: "P08", trigger: "POST", view: "screen:P08", gateway: "idea-scripts.ts", api: "ideas_create" },
      { screen: "P08", trigger: "POST", view: "screen:P08", gateway: "idea-scripts.ts", api: "ideas_reorder" },
    ]);
  });
});
