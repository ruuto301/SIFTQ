import { renderToString } from "hono/jsx/dom/server";
import { describe, expect, it } from "vite-plus/test";
import { DsPage } from "../src/views/DsPage";
import { groupTasksByProject } from "../src/task-list";
import type { Project } from "../src/project";
import type { Task } from "../src/task";
import { taskFixture } from "./helpers/task-fixture";

const PROJECTS: readonly Project[] = [
  { id: "Yoriwake", name: "Yoriwake", sort_order: 1 },
  { id: "dsh", name: "dsh", sort_order: 2 },
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

describe("DsPage task composer", () => {
  it("renders the composer above the group list with the selected project and status", () => {
    const html = renderToString(
      page([taskFixture({ id: "t1", project: "dsh" })], taskFixture({ id: "t1", project: "dsh" }), "skip"),
    );

    expect(html).toContain('id="ds-new-task"');
    expect(html).toContain('id="ds-new-title"');
    expect(html).toContain('placeholder="タスクを追加（skip）"');
    expect(html).toContain('id="ds-new-add"');
    expect(html).toContain('id="ds-new-project"');
    expect(html).toContain('id="ds-new-error"');
    expect(html).toContain('aria-keyshortcuts="Control+Enter Meta+Enter"');
    expect(html).toContain('title="追加 (Ctrl + Enter)"');
    expect(html).toContain("Ctrl + Enter で追加");
    expect(html).toContain('for="ds-new-project"');
    expect(html).toContain('<option value="dsh" selected="">dsh</option>');
    const composer = html.indexOf('id="ds-new-task"');
    const groups = html.indexOf('class="ds__groups"');
    expect(composer).toBeGreaterThanOrEqual(0);
    expect(groups).toBeGreaterThan(composer);
  });

  it("defaults the project to 未分類 when no task is selected", () => {
    const html = renderToString(page([taskFixture({ project: "dsh" })], undefined));

    expect(html).toContain('<option value="Yoriwake">Yoriwake</option>');
    expect(html).toContain('<option value="" selected="">未分類</option>');
    expect(html.indexOf('value="" selected')).toBeGreaterThan(html.indexOf('value="Yoriwake"'));
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

  it("renders the task, chat and settings tabs in order plus the browser pane", () => {
    const html = renderToString(page([taskFixture()], taskFixture()));

    for (const id of ["ds-task", "ds-settings", "ds-browser-canvas", "ds-browser-tabs", "ds-browser-back", "ds-browser-reload"]) {
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).toContain("ds__resizer");
   expect(html).toContain('data-ds-tab="task" role="tab">');
    expect(html).toContain('data-ds-tab="chat" role="tab">');
    expect(html.indexOf('data-ds-tab="task"')).toBeLessThan(html.indexOf('data-ds-tab="chat"'));
    expect(html.indexOf('data-ds-tab="chat"')).toBeLessThan(html.indexOf('data-ds-tab="settings"'));
    expect(html.indexOf('class="ds__tab active" data-ds-tab="task"')).toBeGreaterThan(-1);
    expect(html).not.toContain('data-ds-tab="desc"');
  });
});

describe("DsPage task list", () => {
  it("asks for a task selection when none is provided", () => {
    const html = renderToString(page([], undefined));

    expect(html).toContain("左のタスクを選択してください。");
    // The task pane stays mounted so the tab can explain the empty state.
    expect(html).toContain('id="ds-task"');
    expect(html).not.toContain('id="ds-task-title"');
  });

  it("renders the task editor with the selected title and description (BDD-TM-036)", () => {
    const description = "手順は https://example.com/docs を参照";
    const selected = taskFixture({ id: "t1", title: "DS で編集する", description, version: 4 });
    const html = renderToString(page([selected], selected));

    expect(html).toContain('data-task-description="手順は https://example.com/docs を参照"');
    expect(html).toContain('id="ds-task"');
    expect(html).toContain('data-task-id="t1"');
    expect(html).toContain('data-task-version="4"');
    expect(html).toContain('id="ds-task-title"');
    expect(html).toContain('value="DS で編集する"');
    expect(html).toContain('id="ds-task-description"');
    expect(html).toContain("手順は https://example.com/docs を参照");
    expect(html).toContain('id="ds-task-save"');
    expect(html).toContain('data-ds-pane="task"');
  });

  it("shows the selected task title between the tabs and the chat (BDD-TM-027)", () => {
    const selected = taskFixture({ id: "t1", title: "チャットのタイトルを表示する", project: "Yoriwake" });
    const html = renderToString(page([selected], selected));

    expect(html).toContain('class="ds__chat-title__text">チャットのタイトルを表示する<');
    expect(html).not.toContain("ds__chat-title__label");
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
