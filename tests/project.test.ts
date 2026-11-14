import { describe, expect, it } from "vite-plus/test";
import {
  applyProjectPatch,
  hasProjectName,
  isProjectId,
  isProjectNameValid,
  isProjectOrderValid,
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
  it("maps a stored row and trims the name", () => {
    expect(toProject({ id: "life", name: " 生活 ", sort_order: 2 })).toEqual({
      id: "life",
      name: "生活",
      sort_order: 2,
    });
  });

  it("rejects rows with an invalid id or name", () => {
    expect(toProject({ id: "Bad Id", name: "x", sort_order: 1 })).toBeUndefined();
    expect(toProject({ id: "life", name: "  ", sort_order: 1 })).toBeUndefined();
    expect(toProject({ id: "life", name: "x" })).toBeUndefined();
    expect(toProject(null)).toBeUndefined();
  });
});

describe("sortProjects", () => {
  it("orders by sort_order and then by id without mutating the input", () => {
    const projects = [
      { id: "b", name: "b", sort_order: 2 },
      { id: "a", name: "a", sort_order: 1 },
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

describe("project name validation", () => {
  it("accepts 1 to 32 code points, including Japanese names", () => {
    expect(isProjectNameValid("a")).toBe(true);
    expect(isProjectNameValid("生活")).toBe(true);
    expect(isProjectNameValid("a".repeat(32))).toBe(true);
    expect(isProjectNameValid("")).toBe(false);
    expect(isProjectNameValid("a".repeat(33))).toBe(false);
  });
});

describe("hasProjectName", () => {
  const projects = [
    { id: "life", name: "生活", sort_order: 1 },
    { id: "work", name: "Work", sort_order: 2 },
  ];

  it("matches names regardless of case and surrounding spaces", () => {
    expect(hasProjectName(projects, " work ")).toBe(true);
    expect(hasProjectName(projects, "生活")).toBe(true);
    expect(hasProjectName(projects, "home")).toBe(false);
  });

  it("ignores the project itself when renaming", () => {
    expect(hasProjectName(projects, "生活", "life")).toBe(false);
  });
});

describe("nextProjectOrder", () => {
  it("returns the highest order plus one", () => {
    expect(nextProjectOrder([])).toBe(1);
    expect(
      nextProjectOrder([
        { id: "a", name: "a", sort_order: 3 },
        { id: "b", name: "b", sort_order: 7 },
      ]),
    ).toBe(8);
  });
});

describe("parseProjectCreate", () => {
  it("normalizes the name", () => {
    expect(parseProjectCreate({ id: "gamma", name: " Gamma " })).toEqual({
      ok: true,
      value: { id: "gamma", name: "Gamma" },
    });
    expect(parseProjectCreate({ id: "life", name: "生活" })).toEqual({
      ok: true,
      value: { id: "life", name: "生活" },
    });
  });

  it("ignores the removed path and archived fields", () => {
    expect(parseProjectCreate({ id: "gamma", name: "Gamma", path: "/x", archived: true })).toEqual({
      ok: true,
      value: { id: "gamma", name: "Gamma" },
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
    expect(parseProjectCreate({ id: "gamma", name: "a".repeat(33) })).toEqual({
      ok: false,
      error: { code: "INVALID_PROJECT_NAME" },
    });
  });
});

describe("parseProjectPatch", () => {
  it("reads only the provided fields", () => {
    expect(parseProjectPatch({ name: " Beta " })).toEqual({ ok: true, value: { name: "Beta" } });
    expect(parseProjectPatch({})).toEqual({ ok: true, value: {} });
  });

  it("rejects an invalid name and applies the patch", () => {
    expect(parseProjectPatch({ name: "" })).toEqual({ ok: false, error: { code: "INVALID_PROJECT_NAME" } });

    const project = { id: "a", name: "a", sort_order: 1 };
    const patch = parseProjectPatch({ name: "生活" });
    expect(patch.ok).toBe(true);
    if (!patch.ok) return;
    expect(applyProjectPatch(project, patch.value)).toEqual({ id: "a", name: "生活", sort_order: 1 });
  });
});
