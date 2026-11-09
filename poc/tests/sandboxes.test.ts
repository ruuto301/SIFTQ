import { describe, expect, test } from "bun:test";
import { parseSandboxNames, parseSandboxes, toSandboxPath } from "../server/sandboxes";

describe("parseSandboxNames", () => {
  test("returns .sbx hosts from sbx ls --json output", () => {
    const value = [
      { name: "yoriwake", status: "running" },
      { name: "customer-portal", status: "running" },
      { name: "affiliate", status: "stopped" },
    ];
    expect(parseSandboxNames(value)).toEqual(["affiliate.sbx", "customer-portal.sbx", "yoriwake.sbx"]);
  });

  test("ignores invalid records and duplicate names", () => {
    const value = [{ name: "yoriwake" }, { name: "yoriwake" }, { name: "bad name" }, { name: 123 }, null, "x"];
    expect(parseSandboxNames(value)).toEqual(["yoriwake.sbx"]);
  });

  test("returns an empty list for non-arrays", () => {
    expect(parseSandboxNames(null)).toEqual([]);
    expect(parseSandboxNames({ name: "yoriwake" })).toEqual([]);
  });
});

describe("parseSandboxes", () => {
  test("extracts host and workspace path", () => {
    const value = [
      { name: "yoriwake", status: "running", workspaces: ["C:\\projects\\Yoriwake"] },
      { name: "affiliate", status: "running", workspaces: [] },
    ];
    expect(parseSandboxes(value)).toEqual([
      { name: "affiliate", host: "affiliate.sbx", workspace: null, status: "running" },
      { name: "yoriwake", host: "yoriwake.sbx", workspace: "/c/projects/Yoriwake", status: "running" },
    ]);
  });
});

describe("toSandboxPath", () => {
  test("converts Windows drive paths", () => {
    expect(toSandboxPath("C:\\projects\\Yoriwake")).toBe("/c/projects/Yoriwake");
    expect(toSandboxPath("D:/work/app")).toBe("/d/work/app");
    expect(toSandboxPath("/already/posix")).toBe("/already/posix");
    expect(toSandboxPath("relative/path")).toBeNull();
  });
});
