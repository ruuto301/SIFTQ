import { describe, expect, it } from "vite-plus/test";
import app from "../src/index";
import { SESSION_COOKIE_NAME, createSession } from "../src/auth";
import { createMemoryProjectRepository } from "../src/preview/MemoryProjectRepository";
import type { Project } from "../src/project";
import type { ProjectRepository } from "../src/repository/project-repository";

const SECRET = "project-api-test-secret";

const SEED: readonly Project[] = [
  { id: "alpha", name: "Alpha", path: "/workspace/alpha", sort_order: 1, archived: false },
  { id: "beta", name: "Beta", path: null, sort_order: 2, archived: false },
];

function seeded(): ProjectRepository {
  return createMemoryProjectRepository(SEED);
}

async function request(path: string, init: RequestInit, projects: ProjectRepository) {
  const cookie = await createSession(SECRET, Date.now() + 60_000);
  const headers = new Headers(init.headers);
  headers.set("Cookie", `${SESSION_COOKIE_NAME}=${cookie}`);
  return app.request(path, { ...init, headers }, {
    SESSION_SECRET: SECRET,
    PROJECT_REPOSITORY: projects,
  });
}

function json(method: string, body: unknown): RequestInit {
  return { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

async function listedIds(projects: ProjectRepository): Promise<string[]> {
  const listed: Project[] = await (await request("/api/projects", {}, projects)).json();
  return listed.map((project) => project.id);
}

describe("project create API", () => {
  it("creates a project with the next sort order and returns its location", async () => {
    const projects = seeded();

    const response = await request(
      "/api/projects",
      json("POST", { id: "gamma", name: "Gamma", path: "/workspace/gamma" }),
      projects,
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("Location")).toBe("/api/projects/gamma");
    expect(await response.json()).toEqual({
      id: "gamma",
      name: "Gamma",
      path: "/workspace/gamma",
      sort_order: 3,
      archived: false,
    });
    expect(await listedIds(projects)).toEqual(["alpha", "beta", "gamma"]);
  });

  it("defaults path to null, archived to false, and trims the name", async () => {
    const projects = seeded();

    const response = await request("/api/projects", json("POST", { id: "gamma", name: "  Gamma  " }), projects);

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      id: "gamma",
      name: "Gamma",
      path: null,
      sort_order: 3,
      archived: false,
    });
  });

  it("stores an explicitly archived project", async () => {
    const projects = seeded();

    const response = await request(
      "/api/projects",
      json("POST", { id: "gamma", name: "Gamma", archived: true }),
      projects,
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ id: "gamma", archived: true, sort_order: 3 });
  });

  it("rejects a duplicated id without changing the list", async () => {
    const projects = seeded();

    const response = await request("/api/projects", json("POST", { id: "alpha", name: "Alpha 2" }), projects);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ code: "CONFLICT" });
    expect(await listedIds(projects)).toEqual(["alpha", "beta"]);
  });
});

describe("project create API validation", () => {
  it("rejects an invalid id, name, path, and archived value", async () => {
    const projects = seeded();
    const bodies: Record<string, unknown>[] = [
      { id: "Bad Id", name: "Gamma" },
      { name: "Gamma" },
      { id: "gamma", name: "   " },
      { id: "gamma", name: "Gamma", path: "a".repeat(1025) },
      { id: "gamma", name: "Gamma", path: 3 },
      { id: "gamma", name: "Gamma", archived: "yes" },
    ];

    for (const body of bodies) {
      const response = await request("/api/projects", json("POST", body), projects);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ code: "INVALID_INPUT" });
    }
    expect(await listedIds(projects)).toEqual(["alpha", "beta"]);
  });

  it("rejects a request without a JSON object body", async () => {
    const projects = seeded();

    const response = await request("/api/projects", { method: "POST", body: "not json" }, projects);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ code: "INVALID_INPUT" });
  });
});

describe("project update API", () => {
  it("updates the name and keeps the other fields", async () => {
    const projects = seeded();

    const response = await request("/api/projects/alpha", json("PATCH", { name: "  Alpha 2  " }), projects);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: "alpha",
      name: "Alpha 2",
      path: "/workspace/alpha",
      sort_order: 1,
      archived: false,
    });
  });

  it("archives a project", async () => {
    const projects = seeded();

    const response = await request("/api/projects/beta", json("PATCH", { archived: true }), projects);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: "beta", archived: true });
    const found = await projects.find("beta");
    expect(found).toEqual({ ok: true, value: { ...SEED[1], archived: true } });
  });

  it("clears the path with an explicit null", async () => {
    const projects = seeded();

    const response = await request("/api/projects/alpha", json("PATCH", { path: null }), projects);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: "alpha", path: null });
  });

  it("returns not found for an unknown project", async () => {
    const projects = seeded();

    const response = await request("/api/projects/missing", json("PATCH", { name: "Missing" }), projects);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ code: "NOT_FOUND" });
  });

  it("rejects an invalid name, path, and archived value", async () => {
    const projects = seeded();
    const bodies: Record<string, unknown>[] = [
      { name: "" },
      { name: 3 },
      { path: "a".repeat(1025) },
      { archived: 1 },
    ];

    for (const body of bodies) {
      const response = await request("/api/projects/alpha", json("PATCH", body), projects);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ code: "INVALID_INPUT" });
    }
    const found = await projects.find("alpha");
    expect(found).toEqual({ ok: true, value: SEED[0] });
  });

  it("rejects a request without a JSON object body", async () => {
    const projects = seeded();

    const response = await request("/api/projects/alpha", { method: "PATCH", body: "not json" }, projects);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ code: "INVALID_INPUT" });
  });
});
