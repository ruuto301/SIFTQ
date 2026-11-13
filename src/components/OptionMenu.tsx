import type { FC } from "hono/jsx";
import { TASK_STATUSES } from "../task";
import type { Task, TaskStatus } from "../task";
import type { Project } from "../project";
import { TaskSidePanel } from "./TaskMeta";
import { STATUS_DESCRIPTIONS, STATUS_DOT_CLASSES } from "./task-option-data";

type Choice = {
  value: TaskStatus;
  selected: boolean;
  description: string;
  dotClass: string;
};

function statusChoice(task: Task, value: TaskStatus): Choice {
  return {
    value,
    selected: value === task.status,
    description: STATUS_DESCRIPTIONS[value],
    dotClass: STATUS_DOT_CLASSES[value],
  };
}

function statusSuffix(listStatus: TaskStatus): string {
  return `&status=${listStatus}`;
}

const ChoiceLink: FC<{
  task: Task;
  choice: Choice;
  listStatus: TaskStatus;
}> = ({ task, choice, listStatus }) => {
  const suffix = statusSuffix(listStatus);
  return (
    <a
      class={`status-choice${choice.selected ? " selected" : ""}`}
      href={`/tasks/${task.id}?from=tasks${suffix}`}
      hx-post={`/tasks/${task.id}/status?from=tasks${suffix}`}
      hx-vals={JSON.stringify({ status: choice.value, version: task.version })}
      hx-target="#task-meta"
      hx-swap="innerHTML"
    >
      {choice.selected ? <span class="check">✓</span> : <span class="box"></span>}
      <span class={choice.dotClass}></span>
      <span>
        <strong>{choice.value}</strong>
        <br />
        <span class="muted">{choice.description}</span>
      </span>
    </a>
  );
};

export const OptionMenu: FC<{
  task: Task;
  projects: readonly Project[];
  listStatus?: TaskStatus;
}> = ({ task, projects, listStatus = "do" }) => {
  const choices = TASK_STATUSES.map((status) => statusChoice(task, status));
  const selected = choices.filter((choice) => choice.selected);
  const suggestions = choices.filter((choice) => !choice.selected);
  const cancelHref = `/tasks/${task.id}?from=tasks${statusSuffix(listStatus)}`;
  const renderChoice = (choice: Choice) => (
    <ChoiceLink key={choice.value} task={task} choice={choice} listStatus={listStatus} />
  );

  return (
    <TaskSidePanel task={task} projects={projects} className="side-panel side-panel--popover-open" listStatus={listStatus}>
      <section class="popover" aria-label="Apply status to this task">
        <h3>Apply status to this task</h3>
        <div class="status-group-title">Selected status</div>
        {selected.map(renderChoice)}
        <div class="status-group-title">Suggestions</div>
        {suggestions.map(renderChoice)}
        <a class="status-choice" href={cancelHref} data-cancel>
          Cancel
        </a>
      </section>
    </TaskSidePanel>
  );
};
