import type { FC } from "hono/jsx";
import { TASK_STATUSES } from "../task";
import type { TaskStatus } from "../task";
import type { Project } from "../project";
import { PROJECT_NONE_LABEL, STATUS_DESCRIPTIONS, STATUS_DOT_CLASSES } from "./task-option-data";

export type NewTaskState = {
  status: TaskStatus;
  project: string | null;
};

const NewTaskStatusChoice: FC<{ status: TaskStatus; selected: TaskStatus }> = ({ status, selected }) => (
  <label class={`status-choice${status === selected ? " selected" : ""}`}>
    <input type="radio" name="status" value={status} checked={status === selected} />
    <span class={STATUS_DOT_CLASSES[status]}></span>
    <span>
      <strong>{status}</strong>
      <br />
      <span class="muted">{STATUS_DESCRIPTIONS[status]}</span>
    </span>
  </label>
);

export const NewTaskMeta: FC<{ state: NewTaskState; projects: readonly Project[] }> = ({
  state,
  projects,
}) => {
  return (
    <aside id="new-task-meta" class="side-panel side-panel--popover-open">
      <details data-popover-close="status">
        <summary class="meta-row meta-row-link">
          <h2>Status</h2>
          <span class={`status status--${state.status}`}>{state.status}</span>
        </summary>
        <section class="popover" aria-label="Apply status to this task">
          <h3>Apply status to this task</h3>
          {TASK_STATUSES.map((status) => <NewTaskStatusChoice key={status} status={status} selected={state.status} />)}
          <PopoverCancelButton />
        </section>
      </details>
      <div class="meta-row meta-row--spaced">
        <h2>Project</h2>
      </div>
      <select
        class={state.project === null ? "project-select project-select--none" : "project-select"}
        name="project"
        aria-label="Project"
      >
        <option value="" selected={state.project === null}>
          {PROJECT_NONE_LABEL}
        </option>
        {projects.map((project) => (
          <option value={project.id} selected={state.project === project.id} key={project.id}>
            {project.name}
          </option>
        ))}
      </select>
    </aside>
  );
};

const PopoverCancelButton: FC = () => (
  <button type="button" class="status-choice" data-popover-cancel data-cancel>
    Cancel
  </button>
);
