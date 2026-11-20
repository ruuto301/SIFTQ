import type { FC } from "hono/jsx";
import { TASK_STATUSES } from "../task";
import type { Task, TaskStatus } from "../task";
import type { Project } from "../project";
import type { TaskGroup } from "../task-list";
import {
  DescriptionTabList,
  descriptionDefaultTab,
  descriptionPanelId,
  descriptionTabId,
} from "../components/DescriptionTabs";
import { DescriptionContent } from "../components/DescriptionContent";
import { PROJECT_NONE_LABEL } from "../components/task-option-data";
import { ProjectOptions } from "../components/ProjectOptions";

type TaskPaneProps = {
  groups: readonly TaskGroup[];
  projects: readonly Project[];
  selected: Task | undefined;
  status: TaskStatus;
};

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
          aria-keyshortcuts="Control+Enter Meta+Enter"
        />
        <button type="submit" class="ds__new-add" id="ds-new-add" disabled title="追加 (Ctrl + Enter)">
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
      <p class="ds__new-hint">Ctrl + Enter で追加</p>
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

/** Description 編集 / プレビュー tabs; the preview reuses the DS description field tone. */
function TaskDescriptionField({ task }: { task: Task }) {
  const selected = descriptionDefaultTab(task.description);
  return (
    <div class="ds-task__description-field" data-description-tabs data-default-tab={selected}>
      <DescriptionTabList prefix="ds-description" selected={selected} />
      <div
        id={descriptionPanelId("ds-description", "edit")}
        class="description-tabs__panel"
        role="tabpanel"
        aria-labelledby={descriptionTabId("ds-description", "edit")}
        data-description-panel="edit"
        hidden={selected !== "edit"}
      >
        <label class="ds-task__label" for="ds-description-editor">
          description
        </label>
        <div
          aria-label="Description"
          class="description-editor"
          contenteditable={true}
          data-description-editor
          id="ds-description-editor"
          role="textbox"
          aria-multiline="true"
        >
          <DescriptionContent description={task.description} />
        </div>
        <textarea class="ds-task__description" id="ds-task-description" name="description" data-description-value hidden>
          {task.description}
        </textarea>
      </div>
      <div
        id={descriptionPanelId("ds-description", "preview")}
        class="description-tabs__panel description-preview ds-task__description"
        role="tabpanel"
        aria-labelledby={descriptionTabId("ds-description", "preview")}
        data-description-panel="preview"
        data-description-preview
        hidden={selected !== "preview"}
      ></div>
    </div>
  );
}

/**
 * Task detail pane: edits the selected task title and description. Both fields
 * autosave after typing stops because the DSH agent writes the same fields too.
 */
function TaskEditPane({ selected }: { selected: Task | undefined }) {
  if (selected === undefined) {
    return (
      <div class="ds-task" id="ds-task" data-ds-pane="task">
        <p class="ds__empty">左のタスクを選択してください。</p>
      </div>
    );
  }
  return (
    <div
      class="ds-task"
      id="ds-task"
      data-ds-pane="task"
      data-task-id={selected.id}
      data-task-version={selected.version}
    >
      <div class="ds-task__body">
        <label class="ds-task__label" for="ds-task-title">
          title
        </label>
        <input
          class="ds-task__title"
          id="ds-task-title"
          type="text"
          name="title"
          maxlength={256}
          value={selected.title}
        />
        <TaskDescriptionField task={selected} />
      </div>
      <div class="ds-task__foot">
        <span class="ds-task__status" id="ds-task-status" role="status" aria-live="polite"></span>
        <span class="ds-task__hint">Ctrl + S で保存 / Esc で取り消し</span>
        <button type="button" class="button ds-task__save" id="ds-task-save">
          保存
        </button>
      </div>
      <p class="ds-task__error" id="ds-task-error" role="alert" hidden></p>
    </div>
  );
}

export type DsProjectOption = { id: string; name: string };

/**
 * DS screen: task list (left) and the selected task's detail (right).
 * Both panes are driven by the DS client script.
 */
export const DsPage: FC<{
  groups: TaskGroup[];
  selected: Task | undefined;
  projects: readonly Project[];
  status: TaskStatus;
}> = ({ groups, selected, projects, status }) => {
  const projectOptions: DsProjectOption[] = projects.map((project) => ({
    id: project.id,
    name: project.name,
  }));
  return (
    <div class="ds-page">
      <div
        class="ds"
        id="ds-root"
        data-ds-projects={JSON.stringify(projectOptions)}
        data-ds-view={selected === undefined ? "list" : "detail"}
      >
        <TaskPane groups={groups} projects={projects} selected={selected} status={status} />

        <div
          class="ds__resizer"
          data-resize="left"
          role="separator"
          aria-orientation="vertical"
          aria-label="左ペインの幅"
          aria-valuemin="160"
          aria-valuenow="320"
          aria-valuemax="1280"
          tabindex={0}
        >
          <span class="ds__grip" aria-hidden="true"></span>
          <span class="ds__width-tag" data-ds-width-tag aria-hidden="true">
            320px
          </span>
        </div>

        <section class="ds__pane ds__pane--detail">
          <button type="button" class="ds__back" data-ds-back>
            一覧へ戻る
          </button>
          <TaskEditPane selected={selected} />
        </section>
      </div>
    </div>
  );
};
