import { renderToString } from "hono/jsx/dom/server";
import { describe, expect, it } from "vite-plus/test";
import { DsPage } from "../src/views/DsPage";
import { taskFixture } from "./helpers/task-fixture";

const props = { status: "do", wsUrl: "ws://127.0.0.1:8799", workspace: "/mnt/c/projects" } as const;

describe("DsPage", () => {
  it("renders the task list with the active task", () => {
    const html = renderToString(
      <DsPage tasks={[taskFixture({ id: "t1", title: "first" }), taskFixture({ id: "t2", title: "second" })]} selected={taskFixture({ id: "t2", title: "second" })} {...props} />,
    );

    expect(html).toContain('href="/ds?task=t1"');
    expect(html).toContain("ds__task active");
    expect(html).toContain("second");
  });

  it("renders the chat pane with the selected task and transport url", () => {
    const html = renderToString(<DsPage tasks={[taskFixture({ id: "t1" })]} selected={taskFixture({ id: "t1" })} {...props} />);

    expect(html).toContain('id="dsh-chat"');
    expect(html).toContain('data-task-id="t1"');
    expect(html).toContain('data-ws-url="ws://127.0.0.1:8799"');
    expect(html).toContain('placeholder="指示を入力"');
  });

  it("renders the chat, memo and settings tabs plus the browser pane", () => {
    const html = renderToString(<DsPage tasks={[taskFixture()]} selected={taskFixture()} {...props} />);

    for (const id of ["dsh-memo", "ds-settings", "ds-browser-canvas", "ds-browser-tabs", "ds-browser-back", "ds-browser-reload"]) {
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).toContain("ds__resizer");
  });

  it("asks for a task selection when none is provided", () => {
    const html = renderToString(<DsPage tasks={[]} selected={undefined} {...props} />);

    expect(html).toContain("左のタスクを選択してください。");
    expect(html).not.toContain('id="dsh-memo"');
  });

  it("hands the task description to the memo client", () => {
    const html = renderToString(
      <DsPage tasks={[taskFixture({ description: "手順は https://example.com/docs を参照" })]} selected={taskFixture({ description: "手順は https://example.com/docs を参照" })} {...props} />,
    );

    expect(html).toContain('data-task-description="手順は https://example.com/docs を参照"');
  });

  it("renders the do, done and skip tabs with the active status", () => {
    const html = renderToString(<DsPage tasks={[taskFixture()]} selected={taskFixture()} {...props} status="done" />);

    for (const status of ["do", "done", "skip"]) {
      expect(html).toContain(`href="/ds?status=${status}"`);
    }
    expect(html).toContain('aria-current="true"');
    expect(html).toContain(">done<");
  });
});
