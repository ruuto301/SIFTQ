import { describe, expect, it } from "vite-plus/test";
import { DSH_CHAT_SCRIPT } from "../src/client/dsh-chat-scripts";
import { scriptDiagnostics } from "./helpers/client-script";

describe("DSH chat script", () => {
  it("is valid JavaScript", () => {
    expect(scriptDiagnostics(DSH_CHAT_SCRIPT)).toEqual([]);
  });

  it("drives chat, memo and approval over the transport", () => {
    for (const method of ["session.create", "prompt.send", "approval.respond", "memo.get", "memo.write", "session.configure", "session.access"]) {
      expect(DSH_CHAT_SCRIPT).toContain(method);
    }
  });

  it("sends with Ctrl+Enter and exposes the bridge", () => {
    expect(DSH_CHAT_SCRIPT).toContain("__dsBridge");
    expect(DSH_CHAT_SCRIPT).toContain("ctrlKey");
    expect(DSH_CHAT_SCRIPT).toContain("requestSubmit");
  });
});
