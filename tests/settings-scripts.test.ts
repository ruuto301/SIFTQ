import { describe, expect, it } from "vite-plus/test";
import { SETTINGS_SCRIPT } from "../src/client/settings-scripts";
import { scriptDiagnostics } from "./helpers/client-script";

describe("settings script", () => {
  it("is valid JavaScript", () => {
    expect(scriptDiagnostics(SETTINGS_SCRIPT)).toEqual([]);
  });

  it("calls the project CRUD API", () => {
    expect(SETTINGS_SCRIPT).toContain('"POST", "/api/projects"');
    expect(SETTINGS_SCRIPT).toContain('"PATCH", "/api/projects/"');
    expect(SETTINGS_SCRIPT).toContain('"DELETE", "/api/projects/"');
    expect(SETTINGS_SCRIPT).toContain('"/api/projects/reorder"');
  });

  it("confirms deletion through the shared centered dialog", () => {
    expect(SETTINGS_SCRIPT).toContain("window.__siftqConfirm");
    expect(SETTINGS_SCRIPT).not.toContain("window.confirm(");
    expect(SETTINGS_SCRIPT).toContain("件のタスクは未分類になります");
  });

  it("generates an ASCII id and falls back to a random one", () => {
    expect(SETTINGS_SCRIPT).toContain("function idFor(");
    expect(SETTINGS_SCRIPT).toContain('"p-" + suffix');
  });

  it("renames inline with Enter and Escape", () => {
    expect(SETTINGS_SCRIPT).toContain('"Enter"');
    expect(SETTINGS_SCRIPT).toContain('"Escape"');
  });
});
