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

  it("converts the date range to browser-local bounds", () => {
    expect(IDEA_SCRIPT).toContain("data-idea-date-form");
    expect(IDEA_SCRIPT).toContain("toISOString");
  });

  it("auto-fetches the link preview when the detail dialog opens", () => {
    expect(IDEA_SCRIPT).toContain("ideaDetailFetchPreview(card)");
    expect(IDEA_SCRIPT).toContain('"/preview", { method: "POST" }');
    expect(IDEA_SCRIPT).toContain("ideaCardPreviewNode");
  });

  it("drops the card controls that moved or disappeared", () => {
    // The card only keeps the pin button; delete and preview fetch are gone.
    expect(IDEA_SCRIPT).not.toContain("data-idea-preview-fetch");
    expect(IDEA_SCRIPT).not.toContain("data-idea-delete");
    // The snackbar no longer offers undo.
    expect(IDEA_SCRIPT).not.toContain("data-idea-snackbar-undo");
  });
});
