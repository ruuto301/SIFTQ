import { describe, expect, it } from "vite-plus/test";
import { DS_SETTINGS_SCRIPT } from "../src/client/ds-settings-scripts";
import { scriptDiagnostics } from "./helpers/client-script";

describe("DS settings script", () => {
  it("is valid JavaScript", () => {
    expect(scriptDiagnostics(DS_SETTINGS_SCRIPT)).toEqual([]);
  });

  it("reads and writes settings over the transport", () => {
    for (const method of ["settings.describe", "settings.mutate", "settings.fetchModels", "credentials.describe", "credentials.set"]) {
      expect(DS_SETTINGS_SCRIPT).toContain(method);
    }
    expect(DS_SETTINGS_SCRIPT).toContain("ds-settings-ns");
  });

  it("offers the provider editor and the supported protocols", () => {
    expect(DS_SETTINGS_SCRIPT).toContain("プロバイダー ID");
    for (const protocol of ["openai-completions", "openai-responses", "anthropic-messages"]) {
      expect(DS_SETTINGS_SCRIPT).toContain(protocol);
    }
  });
});
