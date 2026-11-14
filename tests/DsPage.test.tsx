import { renderToString } from "hono/jsx/dom/server";
import { describe, expect, it } from "vite-plus/test";
import { DsPage } from "../src/views/DsPage";
import { groupTasksByProject } from "../src/task-list";
import type { Project } from "../src/project";
import type { Task } from "../src/task";
import { taskFixture } from "./helpers/task-fixture";

const PROJECTS: readonly Project[] = [
  { id: "Yoriwake", name: "Yoriwake", path: null, sort_order: 1, archived: false },
  { id: "dsh", name: "dsh", path: null, sort_order: 2, archived: false },
];

const base = { status: "do", wsUrl: "ws://127.0.0.1:8799", workspace: "/mnt/c/projects" } as const;

function page(tasks: Task[], selected: Task | undefined, status: "do" | "done" | "skip" = "do") {
  return (
    <DsPage
      groups={groupTasksByProject(tasks, PROJECTS)}
      projects={PROJECTS}
      selected={selected}
      status={status}
      wsUrl={base.wsUrl}
      workspace={base.workspace}
    />
  );
}

describe("DsPage", () => {
  it("renders the task list with the active task", () => {
    const html = renderToString(
      page(
        [taskFixture({ id: "t1", title: "first", project: "Yoriwake" }), taskFixture({ id: "t2", title: "second", project: "Yoriwake" })],
        taskFixture({ id: "t2", title: "second", project: "Yoriwake" }),
      ),
    );

    expect(html).toContain('href="/ds?task=t1"');
    expect(html).toContain("ds__task active");
    expect(html).toContain("second");
  });

  it("groups tasks by project with a header per project and 未分類 last", () => {
    const html = renderToString(
      page(
        [
          taskFixture({ id: "t1", title: "yoriwake task", project: "Yoriwake" }),
          taskFixture({ id: "t2", title: "dsh task", project: "dsh" }),
          taskFixture({ id: "t3", title: "unassigned task", project: null }),
        ],
        undefined,
      ),
    );

    expect(html).toContain('class="ds__group" data-ds-group-id="Yoriwake"');
    expect(html).toContain('class="ds__group" data-ds-group-id="dsh"');
    expect(html).toContain('class="ds__group" data-ds-group-id=""');
    expect(html).toContain('data-ds-group-toggle');
    expect(html).toContain("ds__group-count");
    expect(html).toContain('id="ds-groups-status"');
    const yoriwake = html.indexOf('data-ds-group-id="Yoriwake"');
    const unassigned = html.indexOf('data-ds-group-id=""');
    expect(yoriwake).toBeGreaterThanOrEqual(0);
    expect(unassigned).toBeGreaterThan(yoriwake);
  });

  it("renders the chat pane with the selected task and transport url", () => {
    const html = renderToString(page([taskFixture({ id: "t1", project: "dsh" })], taskFixture({ id: "t1", project: "dsh" })));

    expect(html).toContain('id="dsh-chat"');
    expect(html).toContain('data-task-id="t1"');
    expect(html).toContain('data-ws-url="ws://127.0.0.1:8799"');
    expect(html).toContain('placeholder="指示を入力"');
  });

  it("marks task rows for the context menu and shows working only", () => {
    const html = renderToString(
      page([taskFixture({ id: "t9", version: 3, working: true, project: "dsh" })], taskFixture({ id: "t9", working: true, project: "dsh" })),
    );

    expect(html).toContain('data-task-id="t9"');
    expect(html).toContain('data-task-version="3"');
    expect(html).toContain('data-task-status="do"');
    expect(html).toContain('data-task-working="true"');
    expect(html).toContain('data-task-project="dsh"');
    expect(html).toContain('class="working-badge"');
    expect(html).toContain('class="ds__task-head"');
    expect(html).not.toContain('class="status status--do"');
  });

  it("exposes the project options for the client context menu", () => {
    const html = renderToString(page([taskFixture({ project: "dsh" })], undefined));

    expect(html).toContain("data-ds-projects=");
    expect(html).toContain("&quot;Yoriwake&quot;");
  });
});

describe("DsPage chat and browser panes", () => {
  it("renders the send button as an arrow", () => {
    const html = renderToString(page([taskFixture()], taskFixture()));

    expect(html).toContain('id="dsh-chat-send"');
    expect(html).toContain('data-state="send"');
    expect(html).toContain('aria-label="送信"');
    expect(html).toContain("↑");
  });

  it("renders the chat, description and settings tabs plus the browser pane", () => {
    const html = renderToString(page([taskFixture()], taskFixture()));

    for (const id of ["dsh-desc", "ds-settings", "ds-browser-canvas", "ds-browser-tabs", "ds-browser-back", "ds-browser-reload"]) {
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).toContain("ds__resizer");
  });
});

describe("DsPage task list", () => {
  it("asks for a task selection when none is provided", () => {
    const html = renderToString(page([], undefined));

    expect(html).toContain("左のタスクを選択してください。");
    expect(html).not.toContain('id="dsh-desc"');
  });

  it("renders the description pane and hands the text to the client", () => {
    const description = "手順は https://example.com/docs を参照";
    const html = renderToString(page([taskFixture({ description })], taskFixture({ description })));

    expect(html).toContain('data-task-description="手順は https://example.com/docs を参照"');
    expect(html).toContain('id="dsh-desc-view"');
    expect(html).toContain("タスクの説明");
    expect(html).toContain('data-ds-tab="desc"');
  });

  it("shows the selected task title between the tabs and the chat (BDD-TM-027)", () => {
    const selected = taskFixture({ id: "t1", title: "チャットのタイトルを表示する", project: "Yoriwake" });
    const html = renderToString(page([selected], selected));

    expect(html).toContain("ds__chat-title");
    expect(html).toContain('class="ds__chat-title__label">タスク<');
    expect(html).toContain('title="チャットのタイトルを表示する"');
  });

  it("hides the title row when no task is selected", () => {
    const html = renderToString(page([], undefined));

    expect(html).not.toContain("ds__chat-title");
  });

  it("renders the do, done and skip tabs with the active status", () => {
    const html = renderToString(page([taskFixture()], taskFixture(), "done"));

    for (const status of ["do", "done", "skip"]) {
      expect(html).toContain(`href="/ds?status=${status}"`);
    }
    expect(html).toContain('aria-current="true"');
    expect(html).toContain(">done<");
  });
});
