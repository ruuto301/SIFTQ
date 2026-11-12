import { describe, expect, it } from "vite-plus/test";
import { DS_SCRIPT } from "../src/client/ds-scripts";
import { scriptDiagnostics } from "./helpers/client-script";

describe("DS browser script", () => {
  it("is valid JavaScript", () => {
    expect(scriptDiagnostics(DS_SCRIPT)).toEqual([]);
  });

  it("drives the browser transport methods", () => {
    for (const method of [
      "browser.start",
      "browser.navigate",
      "browser.history",
      "browser.input",
      "browser.resize",
      "browser.tab.new",
      "browser.tab.close",
      "browser.tab.select",
    ]) {
      expect(DS_SCRIPT).toContain(method);
    }
    expect(DS_SCRIPT).toContain("ds-browser-canvas");
  });

  it("rejects non-http URLs and ignores frames from inactive tabs", () => {
    expect(DS_SCRIPT).toContain("http(s) の URL のみ開けます");
    expect(DS_SCRIPT).toContain("tabId");
  });
});
