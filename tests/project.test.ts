import { describe, expect, it } from "vite-plus/test";
import {
  applyProjectPatch,
  isProjectId,
  isProjectNameValid,
  isProjectOrderValid,
  isProjectPath,
  nextProjectOrder,
  parseProjectCreate,
  parseProjectPatch,
  sortProjects,
  toProject,
} from "../src/project";

describe("project id", () => {
  it("accepts ids with letters, digits, hyphen and underscore", () => {
    expect(isProjectId("Yoriwake")).toBe(true);
    expect(isProjectId("customer_portal")).toBe(true);
    expect(isProjectId("kits-2")).toBe(true);
    expect(isProjectId("")).toBe(false);
    expect(isProjectId("Yori wake")).toBe(false);
    expect(isProjectId("a".repeat(65))).toBe(false);
    expect(isProjectId(null)).toBe(false);
  });
});

describe("toProject", () => {
  it("maps a stored row and converts the archived flag", () => {
    expect(
      toProject({ id: "dsh", name: "dsh", path: null, sort_order: 2, archived: 1 }),
    ).toEqual({ id: "dsh", name: "dsh", path: null, sort_order: 2, archived: true });
  });

  it("rejects rows with an invalid id or flag", () => {
    expect(toProject({ id: "Bad Id", name: "x", path: null, sort_order: 1, archived: 0 })).toBeUndefined();
    expect(toProject({ id: "dsh", name: "x", path: null, sort_order: 1, archived: 4 })).toBeUndefined();
    expect(toProject(null)).toBeUndefined();
  });
});

describe("sortProjects", () => {
  it("orders by sort_order and then by id without mutating the input", () => {
    const projects = [
      { id: "b", name: "b", path: null, sort_order: 2, archived: false },
      { id: "a", name: "a", path: null, sort_order: 1, archived: false },
    ];

    expect(sortProjects(projects).map((project) => project.id)).toEqual(["a", "b"]);
    expect(projects.map((project) => project.id)).toEqual(["b", "a"]);
  });
});

describe("isProjectOrderValid", () => {
  it("accepts positive safe integers", () => {
    expect(isProjectOrderValid(1)).toBe(true);
    expect(isProjectOrderValid(42)).toBe(true);
  });

  it("rejects zero, negative, fractional, and unsafe values", () => {
    expect(isProjectOrderValid(0)).toBe(false);
    expect(isProjectOrderValid(-1)).toBe(false);
    expect(isProjectOrderValid(1.5)).toBe(false);
    expect(isProjectOrderValid(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
    expect(isProjectOrderValid(Number.NaN)).toBe(false);
  });
});

describe("project input validation", () => {
  it("accepts names of 1 to 100 code points", () => {
    expect(isProjectNameValid("a")).toBe(true);
    expect(isProjectNameValid("a".repeat(100))).toBe(true);
    expect(isProjectNameValid("")).toBe(false);
    expect(isProjectNameValid("a".repeat(101))).toBe(false);
  });

  it("accepts null and bounded paths", () => {
    expect(isProjectPath(null)).toBe(true);
    expect(isProjectPath("/workspace/a")).toBe(true);
    expect(isProjectPath("a".repeat(1024))).toBe(true);
    expect(isProjectPath("a".repeat(1025))).toBe(false);
    expect(isProjectPath(3)).toBe(false);
    expect(isProjectPath(undefined)).toBe(false);
  });
});

describe("nextProjectOrder", () => {
  it("returns the highest order plus one", () => {
    expect(nextProjectOrder([])).toBe(1);
    expect(
      nextProjectOrder([
        { id: "a", name: "a", path: null, sort_order: 3, archived: false },
        { id: "b", name: "b", path: null, sort_order: 7, archived: false },
      ]),
    ).toBe(8);
  });
});

describe("parseProjectCreate", () => {
  it("normalizes the name and optional fields", () => {
    expect(parseProjectCreate({ id: "gamma", name: " Gamma " })).toEqual({
      ok: true,
      value: { id: "gamma", name: "Gamma", path: null, archived: false },
    });
    expect(parseProjectCreate({ id: "gamma", name: "Gamma", path: " ", archived: true })).toEqual({
      ok: true,
      value: { id: "gamma", name: "Gamma", path: null, archived: true },
    });
  });

  it("rejects invalid fields with a specific code", () => {
    expect(parseProjectCreate({ id: "Bad Id", name: "Gamma" })).toEqual({
      ok: false,
      error: { code: "INVALID_PROJECT_ID" },
    });
    expect(parseProjectCreate({ id: "gamma", name: " " })).toEqual({
      ok: false,
      error: { code: "INVALID_PROJECT_NAME" },
    });
    expect(parseProjectCreate({ id: "gamma", name: "Gamma", path: 3 })).toEqual({
      ok: false,
      error: { code: "INVALID_PROJECT_PATH" },
    });
    expect(parseProjectCreate({ id: "gamma", name: "Gamma", archived: "no" })).toEqual({
      ok: false,
      error: { code: "INVALID_PROJECT_ARCHIVED" },
    });
  });
});

describe("parseProjectPatch", () => {
  it("reads only the provided fields", () => {
    expect(parseProjectPatch({ archived: true })).toEqual({ ok: true, value: { archived: true } });
    expect(parseProjectPatch({ name: " Beta ", path: null })).toEqual({
      ok: true,
      value: { name: "Beta", path: null },
    });
    expect(parseProjectPatch({})).toEqual({ ok: true, value: {} });
  });

  it("rejects invalid values and applies to a project", () => {
    expect(parseProjectPatch({ name: "" })).toEqual({ ok: false, error: { code: "INVALID_PROJECT_NAME" } });
    expect(parseProjectPatch({ path: 3 })).toEqual({ ok: false, error: { code: "INVALID_PROJECT_PATH" } });
    expect(parseProjectPatch({ archived: 1 })).toEqual({ ok: false, error: { code: "INVALID_PROJECT_ARCHIVED" } });

    const project = { id: "a", name: "a", path: "/a", sort_order: 1, archived: false };
    const patch = parseProjectPatch({ name: "b", path: null, archived: true });
    expect(patch.ok).toBe(true);
    if (!patch.ok) return;
    expect(applyProjectPatch(project, patch.value)).toEqual({
      id: "a",
      name: "b",
      path: null,
      sort_order: 1,
      archived: true,
    });
  });
});
