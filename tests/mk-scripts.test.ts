import { describe, expect, it } from "vite-plus/test";
import { MK_SCRIPT } from "../src/client/mk-scripts";
import { scriptDiagnostics } from "./helpers/client-script";

describe("MK browser script", () => {
  it("is valid JavaScript", () => {
    expect(scriptDiagnostics(MK_SCRIPT)).toEqual([]);
  });

  it("persists the theme, sort, and saved searches in localStorage", () => {
    expect(MK_SCRIPT).toContain("mk-theme:v1");
    expect(MK_SCRIPT).toContain("mk-sort:v1");
    expect(MK_SCRIPT).toContain("mk-saved-searches:v1");
    expect(MK_SCRIPT).toContain("data-theme");
  });

  it("converts the date range to browser-local bounds and fetches previews", () => {
    expect(MK_SCRIPT).toContain("data-mk-date-form");
    expect(MK_SCRIPT).toContain("toISOString");
    expect(MK_SCRIPT).toContain("/preview");
  });
});
