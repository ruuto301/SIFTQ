import { renderToString } from "hono/jsx/dom/server";
import { describe, expect, it } from "vite-plus/test";
import { DshChatPage } from "../src/views/DshChatPage";
import { taskFixture } from "./helpers/task-fixture";

describe("DshChatPage", () => {
  it("renders the chat form bound to the task and transport", () => {
    const html = renderToString(<DshChatPage task={taskFixture({ id: "t1", title: "write docs" })} wsUrl="ws://127.0.0.1:8799" workspace="/mnt/c/projects" />);

    expect(html).toContain('data-task-id="t1"');
    expect(html).toContain('data-ws-url="ws://127.0.0.1:8799"');
    expect(html).toContain('data-workspace="/mnt/c/projects"');
    expect(html).toContain("write docs");
  });

  it("renders the log, usage, approval and send controls", () => {
    const html = renderToString(<DshChatPage task={taskFixture()} wsUrl="ws://localhost" workspace="/w" />);

    for (const id of ["dsh-chat-log", "dsh-chat-usage", "dsh-chat-approval", "dsh-chat-send", "dsh-chat-form"]) {
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).toContain('placeholder="指示を入力"');
    expect(html).toContain("送信");
  });
});
