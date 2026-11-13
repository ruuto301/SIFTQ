import { describe, expect, it } from "vite-plus/test";
import { DSH_CHAT_SCRIPT } from "../src/client/dsh-chat-scripts";
import { scriptDiagnostics } from "./helpers/client-script";

describe("DSH chat script", () => {
  it("is valid JavaScript", () => {
    expect(scriptDiagnostics(DSH_CHAT_SCRIPT)).toEqual([]);
  });

  it("drives chat, description and approval over the transport", () => {
    for (const method of ["session.create", "prompt.send", "approval.respond", "desc.get", "session.configure", "session.access"]) {
      expect(DSH_CHAT_SCRIPT).toContain(method);
    }
  });

  it("renders the task description and follows description updates", () => {
    expect(DSH_CHAT_SCRIPT).toContain("data-task-description");
    expect(DSH_CHAT_SCRIPT).toContain("dsh-desc-view");
    expect(DSH_CHAT_SCRIPT).toContain("desc.updated");
  });

  it("switches the send button to stop while a turn runs", () => {
    expect(DSH_CHAT_SCRIPT).toContain("prompt.cancel");
    expect(DSH_CHAT_SCRIPT).toContain("dataset.state");
    expect(DSH_CHAT_SCRIPT).toContain('"■"');
  });

  it("labels tool cards with the call id and terminal status", () => {
    expect(DSH_CHAT_SCRIPT).toContain("dataset.callId");
    expect(DSH_CHAT_SCRIPT).toContain("dsh-card--done");
    expect(DSH_CHAT_SCRIPT).toContain("dataset.name");
  });

  it("sends with Ctrl+Enter and exposes the bridge", () => {
    expect(DSH_CHAT_SCRIPT).toContain("__dsBridge");
    expect(DSH_CHAT_SCRIPT).toContain("ctrlKey");
    expect(DSH_CHAT_SCRIPT).toContain("requestSubmit");
  });
});
