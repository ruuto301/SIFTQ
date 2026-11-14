import { describe, expect, it } from "vite-plus/test";
import { CONFIRM_DIALOG_SCRIPT } from "../src/client/confirm-dialog";
import { scriptDiagnostics } from "./helpers/client-script";

describe("shared confirm dialog script", () => {
  it("is valid JavaScript", () => {
    expect(scriptDiagnostics(CONFIRM_DIALOG_SCRIPT)).toEqual([]);
  });

  it("exposes a reusable confirm helper on window (BDD-TM-033)", () => {
    expect(CONFIRM_DIALOG_SCRIPT).toContain("window.__siftqConfirm");
    expect(CONFIRM_DIALOG_SCRIPT).toContain('typeof window.__siftqConfirm === "function"');
  });

  it("builds the existing centered modal markup", () => {
    for (const hook of [
      "matrix-modal-backdrop",
      "matrix-modal",
      "matrix-modal-text",
      "matrix-modal-actions",
      "matrix-modal-button--cancel",
      "matrix-modal-button--danger",
    ]) {
      expect(CONFIRM_DIALOG_SCRIPT).toContain(hook);
    }
  });

  it("cancels on Escape, backdrop click and the cancel button, and only confirms on the danger button", () => {
    expect(CONFIRM_DIALOG_SCRIPT).toContain('"Escape"');
    expect(CONFIRM_DIALOG_SCRIPT).toContain("event.target === backdrop");
    expect(CONFIRM_DIALOG_SCRIPT).toContain("event.target === confirm");
    expect(CONFIRM_DIALOG_SCRIPT).toContain("cancel.focus()");
  });
});
