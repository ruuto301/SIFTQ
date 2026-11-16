import { describe, expect, it } from "vite-plus/test";
import { IDEA_SCRIPT } from "../src/client/idea-scripts";
import { scriptDiagnostics } from "./helpers/client-script";

describe("Ideas browser script", () => {
  it("is valid JavaScript", () => {
    expect(scriptDiagnostics(IDEA_SCRIPT)).toEqual([]);
  });

  it("persists the sort and saved searches in localStorage", () => {
    expect(IDEA_SCRIPT).toContain("idea-sort:v1");
    expect(IDEA_SCRIPT).toContain("idea-saved-searches:v1");
    // The theme switch is gone: the memo colors are fixed.
    expect(IDEA_SCRIPT).not.toContain("idea-theme:v1");
    expect(IDEA_SCRIPT).not.toContain("data-theme");
  });

  it("opens the detail dialog from a card and autosaves the text", () => {
    expect(IDEA_SCRIPT).toContain("data-idea-detail");
    expect(IDEA_SCRIPT).toContain("ideaDetailOpen");
    expect(IDEA_SCRIPT).toContain('ideaApi("/api/ideas/notes/" + encodeURIComponent(id), { method: "PATCH"');
    expect(IDEA_SCRIPT).toContain("setTimeout(function () { ideaDetailSave(root); }, 400)");
  });

  it("converts the date range to browser-local bounds and fetches previews", () => {
    expect(IDEA_SCRIPT).toContain("data-idea-date-form");
    expect(IDEA_SCRIPT).toContain("toISOString");
    expect(IDEA_SCRIPT).toContain("/preview");
  });
});
