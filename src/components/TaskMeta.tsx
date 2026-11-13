import type { FC } from "hono/jsx";
import type { JSX } from "hono/jsx/jsx-runtime";
import type { Project } from "../project";
import type { Task, TaskStatus } from "../task";
import { ProjectOptions } from "./ProjectOptions";

export const TaskMeta: FC<{ task: Task; projects: readonly Project[]; listStatus?: TaskStatus }> = ({
  task,
  projects,
  listStatus = "do",
}) => <TaskSidePanel task={task} projects={projects} listStatus={listStatus} />;

export const TaskSidePanel: FC<{
  task: Task;
  projects: readonly Project[];
  className?: string;
  children?: JSX.Element;
  listStatus?: TaskStatus;
}> = ({ task, projects, className = "side-panel", children, listStatus = "do" }) => {
  const statusQuery = `&status=${listStatus}`;
  const detailPath = `/tasks/${task.id}?from=tasks${statusQuery}`;
  const statusPath = `/tasks/${task.id}/status/menu?from=tasks${statusQuery}`;
  const projectPath = `/tasks/${task.id}/project?from=tasks${statusQuery}`;

  return (
    <aside
      id="task-meta"
      class={className}
      data-popover-close-href={children === undefined ? undefined : detailPath}
    >
      <MetaRow label="Status" path={statusPath} />
      <a
        class={`status status--${task.status}`}
        href={statusPath}
        hx-get={statusPath}
        hx-target="#task-meta"
        hx-swap="innerHTML"
      >
        {task.status}
      </a>
      <div class="meta-row meta-row--spaced">
        <h2>Project</h2>
      </div>
      <select
        class={task.project === null ? "project-select project-select--none" : "project-select"}
        name="project"
        aria-label="Project"
        hx-post={projectPath}
        hx-trigger="change"
        hx-vals={JSON.stringify({ version: task.version })}
        hx-target="#task-meta"
        hx-swap="innerHTML"
      >
        <ProjectOptions projects={projects} selected={task.project} />
      </select>
      <div class="meta-row meta-row--spaced">
        <h2>Working</h2>
      </div>
      <button
        class={task.working ? "status working-badge" : "status"}
        hx-post={`/tasks/${task.id}/working?from=tasks${statusQuery}`}
        hx-vals={JSON.stringify({ working: task.working ? "false" : "true", version: task.version })}
        hx-target="#task-meta"
        hx-swap="innerHTML"
        aria-pressed={task.working ? "true" : "false"}
      >
        {task.working ? "working" : "not working"}
      </button>
      {children}
    </aside>
  );
};

const MetaRow: FC<{ label: string; path: string; spaced?: boolean }> = ({
  label,
  path,
  spaced,
}) => (
  <a
    class={`meta-row meta-row-link${spaced ? " meta-row--spaced" : ""}`}
    href={path}
    hx-get={path}
    hx-target="#task-meta"
    hx-swap="innerHTML"
  >
    <h2>{label}</h2>
    <span class="meta-caret" aria-hidden="true">
      ▾
    </span>
  </a>
);
