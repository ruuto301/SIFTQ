import { describe, expect, it } from "vite-plus/test";
import app from "../src/index";
import { TEST_SECRET, authBindings, authenticatedRequest } from "./helpers/authenticated-request";
import { createMemoryTaskRepository } from "./helpers/memory-task-repository";

describe("smoke", () => {
  it("renders the Matrix route", async () => {
    const response = await authenticatedRequest("/matrix", createMemoryTaskRepository());

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Matrix");
  });

  it("accepts the internal transport token on the task API", async () => {
    const repo = createMemoryTaskRepository();
    const bindings = { ...authBindings(repo), DSH_INTERNAL_TOKEN: "transport-secret" };
    const authorized = await app.request("/api/tasks", { headers: { authorization: "Bearer transport-secret" } }, bindings);
    const rejected = await app.request("/api/tasks", { headers: { authorization: "Bearer wrong" } }, bindings);

    expect(authorized.status).toBe(200);
    expect(rejected.status).toBe(401);
    expect(TEST_SECRET).toBe("test-secret");
  });

  it("serves the HTMX conflict response handler without authentication", async () => {
    const response = await app.request("/htmx-conflict.js");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/javascript");
    expect(await response.text()).toContain("xhr.status !== 409");
  });

  it("serves the popover dismissal handler without authentication", async () => {
    const response = await app.request("/popover-dismiss.js");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/javascript");
    const body = await response.text();
    expect(body).toContain("window.location.assign");
    expect(body).toContain("[data-popover-close]");
    expect(body).toContain("[data-popover-cancel]");
  });

  it("serves the new task keyboard shortcut handler without authentication", async () => {
    const response = await app.request("/task-form-shortcut.js");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/javascript");
    const body = await response.text();
    expect(body).toContain('event.ctrlKey || event.key !== "Enter"');
    expect(body).toContain('form[data-task-form]');
    expect(body).toContain("form.requestSubmit()");
    expect(body).toContain("pageshow");
    expect(body).toContain("event.persisted");
    expect(body).toContain('data-task-form="edit"');
  });

  it("serves the matrix area navigation handler without authentication", async () => {
    const response = await app.request("/matrix-dnd.js");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/javascript");
    const body = await response.text();
    expect(body).toContain('closest(".area--quadrant[data-drop-area]")');
    expect(body).toContain('window.location.assign("/tasks/new?area=" + encodeURIComponent(area) + "&from=matrix")');
  });
});
