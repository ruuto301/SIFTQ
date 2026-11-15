import { DescriptionContent } from "../components/DescriptionContent";
import { TaskMeta } from "../components/TaskMeta";
import { NewTaskMeta } from "../components/NewTaskMeta";
import type { NewTaskState } from "../components/NewTaskMeta";
import type { Project } from "../project";
import type { Task, TaskStatus } from "../task";

function TitleField({ value }: { value?: string }) {
  return (
    <label>
      Title
      <input type="text" name="title" value={value} maxlength={256} required />
    </label>
  );
}

type DescriptionTab = "edit" | "preview";

const DESCRIPTION_TABS: readonly { tab: DescriptionTab; label: string }[] = [
  { tab: "edit", label: "編集" },
  { tab: "preview", label: "プレビュー" },
];

/** Task detail opens on the rendered description; an empty description opens the editor. */
function descriptionDefaultTab(description: string): DescriptionTab {
  return description.trim() === "" ? "edit" : "preview";
}

function DescriptionTabList({ selected }: { selected: DescriptionTab }) {
  return (
    <div class="description-tabs" role="tablist" aria-label="Description view">
      {DESCRIPTION_TABS.map(({ tab, label }) => (
        <button
          key={tab}
          type="button"
          role="tab"
          id={`description-tab-${tab}`}
          class="description-tab"
          data-description-tab={tab}
          aria-controls={`description-panel-${tab}`}
          aria-selected={tab === selected ? "true" : "false"}
          tabindex={tab === selected ? 0 : -1}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function DescriptionField({ children, defaultTab }: { children?: string; defaultTab: DescriptionTab }) {
  const description = children ?? "";
  return (
    <div class="description-field" data-description-tabs data-default-tab={defaultTab}>
      <DescriptionTabList selected={defaultTab} />
      <div
        id="description-panel-edit"
        class="description-tabs__panel"
        role="tabpanel"
        aria-labelledby="description-tab-edit"
        data-description-panel="edit"
        hidden={defaultTab !== "edit"}
      >
        <label>
          Description
          <div
            aria-label="Description"
            class="description-editor"
            contenteditable={true}
            data-description-editor
            role="textbox"
            aria-multiline="true"
          >
            <DescriptionContent description={description} />
          </div>
        </label>
        <textarea name="description" data-description-value hidden>
          {description}
        </textarea>
      </div>
      <div
        id="description-panel-preview"
        class="description-tabs__panel description-preview"
        role="tabpanel"
        aria-labelledby="description-tab-preview"
        data-description-panel="preview"
        data-description-preview
        hidden={defaultTab !== "preview"}
      ></div>
    </div>
  );
}

export function TaskVersionInput({ version, outOfBand = false }: { version: number; outOfBand?: boolean }) {
  return (
    <input
      id="task-version"
      type="hidden"
      name="version"
      value={version}
      hx-swap-oob={outOfBand ? "true" : undefined}
    />
  );
}

function TaskFormActions({ submitLabel, cancelHref }: { submitLabel: string; cancelHref: string }) {
  return (
    <div class="form-actions">
      <a class="button" href={cancelHref} data-cancel>
        Cancel
      </a>
      <button class="button primary" type="submit">
        {submitLabel}
      </button>
    </div>
  );
}

export function NewTaskForm({
  state,
  projects,
  error,
}: {
  state: NewTaskState;
  projects: readonly Project[];
  error?: string;
}) {
  return (
    <div class="page page--new" data-state="normal">
      <div class="page-header">
        <h1 class="page-title">New task</h1>
      </div>
      <form class="detail-grid" data-task-form="new" hx-post="/tasks" hx-target="#page" hx-swap="innerHTML">
        <div class="form-panel">
          <TitleField />
          {error ? <p class="error">{error}</p> : null}
          <DescriptionField defaultTab="edit" />
          <TaskFormActions submitLabel="Create" cancelHref="/tasks" />
        </div>
        <NewTaskMeta state={state} projects={projects} />
      </form>
    </div>
  );
}

export function TaskDetailPage({
  task,
  projects,
  error,
  listStatus = "do",
}: {
  task: Task;
  projects: readonly Project[];
  error?: string;
  listStatus?: TaskStatus;
}) {
  const cancelHref = `/tasks?status=${listStatus}`;

  return (
    <div class="page page--detail" data-state="normal">
      <div class="page-header">
        <h1 class="page-title">Task detail</h1>
        <a class="button" href={cancelHref}>
          Tasks
        </a>
        <a class="button" href={`/tasks/${task.id}/chat`}>
          DSH chat
        </a>
      </div>
      <div class="detail-grid">
        <form
          class="form-panel"
          data-task-form="edit"
          method="post"
          action={`/tasks/${task.id}`}
          hx-post={`/tasks/${task.id}`}
          hx-target="#page"
          hx-swap="innerHTML"
        >
          <TitleField value={task.title} />
          <TaskVersionInput version={task.version} />
          {error ? <p class="error">{error}</p> : null}
          <DescriptionField defaultTab={descriptionDefaultTab(task.description)}>{task.description}</DescriptionField>
          <TaskFormActions submitLabel="Save" cancelHref={cancelHref} />
        </form>
        <TaskMeta task={task} projects={projects} listStatus={listStatus} />
      </div>
    </div>
  );
}
