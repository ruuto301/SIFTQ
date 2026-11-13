import { describe, expect, it } from "vite-plus/test";
import { isProjectId, isProjectOrderValid, sortProjects, toProject } from "../src/project";

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
