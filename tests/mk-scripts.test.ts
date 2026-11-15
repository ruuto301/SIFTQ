import { describe, expect, it } from "vite-plus/test";
import { MK_SCRIPT } from "../src/client/mk-scripts";
import { scriptDiagnostics } from "./helpers/client-script";

describe("MK browser script", () => {
  it("is valid JavaScript", () => {
    expect(scriptDiagnostics(MK_SCRIPT)).toEqual([]);
  });

  it("persists the sort and saved searches in localStorage", () => {
    expect(MK_SCRIPT).toContain("mk-sort:v1");
    expect(MK_SCRIPT).toContain("mk-saved-searches:v1");
    // The theme switch is gone: the memo colors are fixed.
    expect(MK_SCRIPT).not.toContain("mk-theme:v1");
    expect(MK_SCRIPT).not.toContain("data-theme");
  });

  it("opens the detail dialog from a card and autosaves the text", () => {
    expect(MK_SCRIPT).toContain("data-mk-detail");
    expect(MK_SCRIPT).toContain("mkDetailOpen");
    expect(MK_SCRIPT).toContain('mkApi("/api/mk/notes/" + encodeURIComponent(id), { method: "PATCH"');
    expect(MK_SCRIPT).toContain("setTimeout(function () { mkDetailSave(root); }, 400)");
  });

  it("converts the date range to browser-local bounds and fetches previews", () => {
    expect(MK_SCRIPT).toContain("data-mk-date-form");
    expect(MK_SCRIPT).toContain("toISOString");
    expect(MK_SCRIPT).toContain("/preview");
  });
});
