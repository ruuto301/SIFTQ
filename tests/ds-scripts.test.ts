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

  it("opens a task context menu with status, working and delete actions", () => {
    expect(DS_SCRIPT).toContain("contextmenu");
    expect(DS_SCRIPT).toContain("data-task-version");
    expect(DS_SCRIPT).toContain("/api/tasks/");
    for (const label of ["進行中", "完了", "見送り", "作業中にする", "削除"]) {
      expect(DS_SCRIPT).toContain(label);
    }
  });

  it("rejects non-http URLs and ignores frames from inactive tabs", () => {
    expect(DS_SCRIPT).toContain("http(s) の URL のみ開けます");
    expect(DS_SCRIPT).toContain("tabId");
  });
});
