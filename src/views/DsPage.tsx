import type { FC } from "hono/jsx";
import { TASK_STATUSES } from "../task";
import type { Task, TaskStatus } from "../task";
import type { Project } from "../project";
import type { TaskGroup } from "../task-list";
import { PROJECT_NONE_LABEL } from "../components/task-option-data";
import { ProjectOptions } from "../components/ProjectOptions";

type TaskPaneProps = {
  groups: readonly TaskGroup[];
  projects: readonly Project[];
  selected: Task | undefined;
  status: TaskStatus;
};
type ChatPaneProps = { selected: Task | undefined; wsUrl: string; workspace: string };

function StatusTabs({ active }: { active: TaskStatus }) {
  return (
    <nav class="task-status-filter task-status-filter--toolbar ds__status-tabs" aria-label="Filter tasks by status" data-task-status-tabs>
      {TASK_STATUSES.map((status) => (
        <a
          key={status}
          class={status === active ? "button small is-active" : "button small"}
          aria-current={status === active ? "true" : undefined}
          href={`/ds?status=${status}`}
        >
          {status}
        </a>
      ))}
    </nav>
  );
}

function TaskItem({ task, selected }: { task: Task; selected: Task | undefined }) {
  return (
    <li
      class="ds__task-item"
      data-task-id={task.id}
      data-task-version={task.version}
      data-task-status={task.status}
      data-task-working={task.working ? "true" : "false"}
      data-task-project={task.project ?? ""}
    >
      <a
        class={selected?.id === task.id ? "ds__task active" : "ds__task"}
        href={`/ds?task=${encodeURIComponent(task.id)}`}
      >
        <span class="ds__task-head">
          <span class="ds__task-title">{task.title}</span>
        </span>
        <span class="ds__task-meta">
          {task.working ? <span class="working-badge">working</span> : null}
        </span>
      </a>
    </li>
  );
}

function TaskGroupSection({ group, selected }: { group: TaskGroup; selected: Task | undefined }) {
  const projectId = group.project?.id ?? "";
  return (
    <section class="ds__group" data-ds-group-id={projectId}>
      <button type="button" class="ds__group-head" data-ds-group-toggle aria-expanded="true">
        <span class="ds__group-caret" aria-hidden="true">
          ▾
        </span>
        <span class="ds__group-name">{group.project?.name ?? PROJECT_NONE_LABEL}</span>
        <span class="ds__group-count">{group.tasks.length}</span>
      </button>
      <ul class="ds__tasks">
        {group.tasks.map((task) => (
          <TaskItem key={task.id} task={task} selected={selected} />
        ))}
      </ul>
    </section>
  );
}

/**
 * Task composer above the group list. The project default is the selected task,
 * so adding a task keeps it in the group the user is looking at.
 */
function TaskComposer({
  projects,
  selected,
  status,
}: {
  projects: readonly Project[];
  selected: Task | undefined;
  status: TaskStatus;
}) {
  return (
    <form class="ds__new" id="ds-new-task" autocomplete="off">
      <div class="ds__new-row">
        <label class="ds__new-label ds__new-label--hidden" for="ds-new-title">
          新しいタスク
        </label>
        <input
          class="ds__new-input"
          id="ds-new-title"
          type="text"
          maxlength={256}
          placeholder={`タスクを追加（${status}）`}
          aria-describedby="ds-new-error"
        />
        <button type="submit" class="ds__new-add" id="ds-new-add" disabled>
          追加
        </button>
      </div>
      <div class="ds__new-row">
        <label class="ds__new-label" for="ds-new-project">
          追加先
        </label>
        <select class="ds__new-project" id="ds-new-project">
          <ProjectOptions projects={projects} selected={selected?.project ?? null} noneLast />
        </select>
      </div>
    </form>
  );
}

function TaskPane({ groups, projects, selected, status }: TaskPaneProps) {
  return (
    <aside class="ds__pane ds__pane--tasks">
      <div class="ds__pane-head">Tasks</div>
      <StatusTabs active={status} />
      <TaskComposer projects={projects} selected={selected} status={status} />
      <div class="ds__new-error" id="ds-new-error" role="alert" hidden></div>
      <div class="ds__groups-status" id="ds-groups-status" role="status" hidden></div>
      <div class="ds__groups">
        {groups.map((group) => (
          <TaskGroupSection key={group.project?.id ?? "__none__"} group={group} selected={selected} />
        ))}
      </div>
    </aside>
  );
}

function ChatHeader() {
  return (
    <div class="ds__pane-head">
      <div class="ds__tabs" role="tablist">
        <button type="button" class="ds__tab active" data-ds-tab="chat" role="tab">
          Chat
        </button>
        <button type="button" class="ds__tab" data-ds-tab="desc" role="tab">
          説明
        </button>
        <button type="button" class="ds__tab" data-ds-tab="settings" role="tab">
          設定
        </button>
      </div>
      <div class="ds__chat-tools">
        <select id="dsh-chat-model" aria-label="モデル"></select>
        <div class="ds__access">
          <button type="button" class="ds__pill" id="dsh-chat-access" aria-haspopup="menu" aria-expanded="false">
            ワークスペース書き込み
          </button>
          <div class="ds__menu" id="dsh-chat-access-menu" hidden>
            <button type="button" data-mode="read-only">読み取り専用</button>
            <button type="button" data-mode="workspace-write">ワークスペース書き込み</button>
            <button type="button" data-mode="danger-full-access">フルアクセス</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatPane({ selected, wsUrl, workspace }: ChatPaneProps) {
  if (selected === undefined) return <p class="ds__empty">左のタスクを選択してください。</p>;
  return (
    <div
      class="dsh-chat"
      id="dsh-chat"
      data-ds-pane="chat"
      data-task-id={selected.id}
      data-ws-url={wsUrl}
      data-workspace={workspace}
      data-task-description={selected.description}
    >
      <div class="dsh-chat__usage" id="dsh-chat-usage" hidden></div>
      <div class="dsh-chat__log" id="dsh-chat-log" aria-live="polite"></div>
      <div class="dsh-chat__approval" id="dsh-chat-approval" hidden></div>
      <form class="dsh-chat__form" id="dsh-chat-form">
        <textarea id="dsh-chat-input" rows={3} placeholder="指示を入力"></textarea>
        <div class="dsh-chat__buttons">
          <button
            type="button"
            class="dsh-chat__send"
            id="dsh-chat-send"
            data-state="send"
            aria-label="送信"
            title="送信 (Ctrl+Enter)"
          >
            ↑
          </button>
        </div>
      </form>
    </div>
  );
}

function DescPane() {
  return (
    <div class="dsh-desc" id="dsh-desc" data-ds-pane="desc" hidden>
      <div class="dsh-desc__bar">
        <span class="dsh-desc__title">タスクの説明</span>
      </div>
      <div class="dsh-desc__view" id="dsh-desc-view"></div>
    </div>
  );
}

function SettingsPane() {
  return (
    <div class="ds-settings" id="ds-settings" data-ds-pane="settings" hidden>
      <div class="ds-settings__ns" id="ds-settings-ns"></div>
      <div class="ds-settings__body">
        <div class="ds-settings__head">
          <span class="ds-settings__title" id="ds-settings-title">設定</span>
          <span class="ds-settings__status" id="ds-settings-status"></span>
          <button type="button" class="button" id="ds-settings-save">
            保存
          </button>
        </div>
        <div class="ds-settings__form" id="ds-settings-form"></div>
        <textarea class="ds-settings__json" id="ds-settings-json" hidden></textarea>
      </div>
    </div>
  );
}

function BrowserPane() {
  return (
    <aside class="ds__pane ds__pane--browser">
      <div class="ds__pane-head">
        <span>Browser</span>
        <span class="ds__browser-status" id="ds-browser-status"></span>
        <button type="button" class="ds__max" id="ds-browser-max" title="最大化">
          最大化
        </button>
      </div>
      <div class="ds__tabs-bar" id="ds-browser-tabs"></div>
      <form class="ds__browser-bar" id="ds-browser-form">
        <button type="button" class="ds__nav" id="ds-browser-back" title="戻る">
          ←
        </button>
        <button type="button" class="ds__nav" id="ds-browser-forward" title="進む">
          →
        </button>
        <button type="button" class="ds__nav" id="ds-browser-reload" title="再読み込み">
          ⟳
        </button>
        <input id="ds-browser-url" type="text" placeholder="https://example.com" />
        <button type="submit" class="button">
          開く
        </button>
      </form>
      <canvas id="ds-browser-canvas" tabindex={0}></canvas>
    </aside>
  );
}

export type DsProjectOption = { id: string; name: string };

/**
 * DS screen: task list (left), DSH chat (center), browser (right).
 * The chat, memo, settings and browser panes are driven by client scripts.
 */
export const DsPage: FC<{
  groups: TaskGroup[];
  selected: Task | undefined;
  projects: readonly Project[];
  status: TaskStatus;
  wsUrl: string;
  workspace: string;
}> = ({ groups, selected, projects, status, wsUrl, workspace }) => {
  const projectOptions: DsProjectOption[] = projects.map((project) => ({
    id: project.id,
    name: project.name,
  }));
  return (
    <div class="ds" id="ds-root" data-ds-projects={JSON.stringify(projectOptions)}>
      <TaskPane groups={groups} projects={projects} selected={selected} status={status} />

      <div class="ds__resizer" data-resize="left" role="separator" aria-orientation="vertical" aria-label="左ペインの幅"></div>

      <section class="ds__pane ds__pane--chat">
        <ChatHeader />
        {selected === undefined ? null : (
          <div class="ds__chat-title">
            <span class="ds__chat-title__text">{selected.title}</span>
          </div>
        )}
        <ChatPane selected={selected} wsUrl={wsUrl} workspace={workspace} />
        {selected === undefined ? null : <DescPane />}
        <SettingsPane />
      </section>

      <div class="ds__resizer" data-resize="right" role="separator" aria-orientation="vertical" aria-label="ブラウザペインの幅"></div>

      <BrowserPane />
    </div>
  );
};
