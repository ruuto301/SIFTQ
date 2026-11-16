import { describe, expect, it } from "vite-plus/test";
import { DESCRIPTION_TABS_SCRIPT } from "../src/client/description-tabs-scripts";
import { scriptDiagnostics } from "./helpers/client-script";

describe("description tabs browser script", () => {
  it("is valid JavaScript", () => {
    expect(scriptDiagnostics(DESCRIPTION_TABS_SCRIPT)).toEqual([]);
  });

  it("drives the shared task and DS description tab markup", () => {
    for (const token of [
      "[data-description-tabs]",
      "[data-description-tab]",
      "[data-description-panel]",
      "[data-description-preview]",
      "data-description-value",
    ]) {
      expect(DESCRIPTION_TABS_SCRIPT).toContain(token);
    }
    expect(DESCRIPTION_TABS_SCRIPT).toContain("/api/markdown/preview");
  });

  it("handles keyboard navigation and late script execution", () => {
    expect(DESCRIPTION_TABS_SCRIPT).toContain("ArrowLeft");
    expect(DESCRIPTION_TABS_SCRIPT).toContain("ArrowRight");
    expect(DESCRIPTION_TABS_SCRIPT).toContain("Home");
    expect(DESCRIPTION_TABS_SCRIPT).toContain("End");
    expect(DESCRIPTION_TABS_SCRIPT).toContain("htmx:load");
    expect(DESCRIPTION_TABS_SCRIPT).toContain("aria-selected");
  });
});

// covers: BDD-TM-053
describe("description indentation (BDD-TM-053)", () => {
  it("normalizes non-breaking spaces so indentation survives", () => {
    expect(DESCRIPTION_TABS_SCRIPT).toContain('replace(/\\u00a0/g, " ")');
  });
});
