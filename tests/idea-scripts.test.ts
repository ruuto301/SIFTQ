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

  it("keeps the composer scroll position while the body grows", () => {
    expect(IDEA_SCRIPT).toContain("var savedFieldTop = field.scrollTop;");
    expect(IDEA_SCRIPT).toContain("var savedWindowY = window.scrollY;");
    expect(IDEA_SCRIPT).toContain("window.scrollTo(0, savedWindowY)");
  });

  it("keeps the detail scroll position while the body grows", () => {
    expect(IDEA_SCRIPT).toContain("var savedScrollTop = scroll ? scroll.scrollTop : 0;");
    expect(IDEA_SCRIPT).toContain("if (scroll && scroll.scrollTop !== savedScrollTop) scroll.scrollTop = savedScrollTop;");
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
    // The unused snackbar is gone entirely.
    expect(IDEA_SCRIPT).not.toContain("data-idea-snackbar");
  });
});

describe("Ideas image paste script", () => {
  it("deduplicates clipboard files by name, size, type, and lastModified", () => {
    expect(IDEA_SCRIPT).toContain("function ideaFileFingerprint(file)");
    expect(IDEA_SCRIPT).toContain('[file.name || "", file.size || 0, file.type || "", file.lastModified || 0]');
    expect(IDEA_SCRIPT).toContain("if (seen.indexOf(key) !== -1) return;");
  });

  it("deduplicates clipboard files by name, size, type, and lastModified", () => {
    expect(IDEA_SCRIPT).toContain("function ideaFileFingerprint(file)");
    expect(IDEA_SCRIPT).toContain('[file.name || "", file.size || 0, file.type || "", file.lastModified || 0]');
    expect(IDEA_SCRIPT).toContain("if (seen.indexOf(key) !== -1) return;");
  });

  it("inserts a pasted image at the caret of the body textarea", () => {
    expect(IDEA_SCRIPT).toContain('document.execCommand("insertText", false, text)');
    expect(IDEA_SCRIPT).toContain("field.setRangeText(text, start, end, \"end\")");
    expect(IDEA_SCRIPT).toContain("target.closest(\"[data-idea-composer-body]\")");
    expect(IDEA_SCRIPT).toContain("target.closest(\"[data-idea-detail-body]\")");
  });

  it("replaces the pending token with the uploaded attachment URL", () => {
    expect(IDEA_SCRIPT).toContain('var IDEA_PENDING_PREFIX = "pending-";');
    expect(IDEA_SCRIPT).toContain('return "![](" + IDEA_PENDING_PREFIX + String(Date.now()) + "-" + String(ideaPasteSequence) + ")";');
    expect(IDEA_SCRIPT).toContain('field.setRangeText(replacement, index, index + token.length, "preserve")');
    expect(IDEA_SCRIPT).toContain('ideaInsertReplace(field, token, "![](" + attachment.url + ")")');
  });

  it("keeps non-image files on the attachment path", () => {
    expect(IDEA_SCRIPT).toContain("function ideaPasteAttachments(page, files)");
    expect(IDEA_SCRIPT).toContain("function ideaPasteIsImage(file) { return ideaAttachmentKindOf(file) === \"image\"; }");
    expect(IDEA_SCRIPT).toContain("ideaQueueComposerFiles(composer, files);");
  });

  it("uploads composer images after the note exists and patches the replaced body", () => {
    expect(IDEA_SCRIPT).toContain("function ideaUploadComposerInline(composer, noteId)");
    expect(IDEA_SCRIPT).toContain("ideaUploadComposerInline(composer, note.id)");
    expect(IDEA_SCRIPT).toContain('method: "PATCH",');
    expect(IDEA_SCRIPT).toContain("body: JSON.stringify({ body: field.value })");
  });

  it("re-renders the card body segments after autosave", () => {
    expect(IDEA_SCRIPT).toContain("function ideaBodySegments(body)");
    expect(IDEA_SCRIPT).toContain("function ideaCardBodyNode(body)");
    expect(IDEA_SCRIPT).toContain('image.className = "idea-card__image"');
    expect(IDEA_SCRIPT).toContain("card.replaceChild(ideaCardBodyNode(note.body), body)");
  });
});
