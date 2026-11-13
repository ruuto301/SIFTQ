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

function DescriptionField({ children }: { children?: string }) {
  const description = children ?? "";
  return (
    <>
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
    </>
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
          <DescriptionField />
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
          <DescriptionField>{task.description}</DescriptionField>
          <TaskFormActions submitLabel="Save" cancelHref={cancelHref} />
        </form>
        <TaskMeta task={task} projects={projects} listStatus={listStatus} />
      </div>
    </div>
  );
}
