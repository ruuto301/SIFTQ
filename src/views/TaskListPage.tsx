import { TASK_STATUSES } from "../task";
import type { Task, TaskStatus } from "../task";
import type { Project } from "../project";
import { pageNavItems, withQueryToken } from "../task-list";
import type { TaskWorkingFilter } from "../task-list";
import { TaskRow } from "../components/TaskRow";
import { NewTaskLink } from "./navigation";

const TASK_STATUS_OPTIONS: { status: TaskStatus; label: string }[] = TASK_STATUSES.map((status) => ({
  status,
  label: status,
}));

function TaskStatusFilter({ status, working }: { status: TaskStatus; working: TaskWorkingFilter | undefined }) {
  const workingParam = working === undefined ? "" : `&working=${working}`;
  return (
    <>
      <nav
        class="task-status-filter task-status-filter--toolbar"
        aria-label="Filter tasks by status"
        data-task-status-tabs
      >
        {TASK_STATUS_OPTIONS.map((option) => (
          <a
            key={option.status}
            class={option.status === status ? "button small is-active" : "button small"}
            aria-current={option.status === status ? "true" : undefined}
            href={`/tasks?status=${option.status}${workingParam}`}
          >
            {option.label}
          </a>
        ))}
      </nav>
      <p
        class="task-selection-summary task-selection-summary--toolbar"
        data-task-selection-summary
        aria-live="polite"
        hidden
      >
        0 of 0 selected
      </p>
    </>
  );
}

function PageNavLink({
  status,
  page,
  working,
  query,
}: {
  status: TaskStatus;
  page: number;
  working: TaskWorkingFilter | undefined;
  query: string | undefined;
}) {
  const workingParam = working === undefined ? "" : `&working=${working}`;
  const queryParam = query === undefined ? "" : `&q=${encodeURIComponent(query)}`;
  return (
    <a
      class="button small"
      href={`/tasks?status=${status}${workingParam}${queryParam}&page=${page}`}
      aria-label={`Page ${page}`}
    >
      {page}
    </a>
  );
}

function PageNavItem({
  item,
  index,
  status,
  currentPage,
  working,
  query,
}: {
  item: number | "ellipsis";
  index: number;
  status: TaskStatus;
  currentPage: number;
  working: TaskWorkingFilter | undefined;
  query: string | undefined;
}) {
  if (item === "ellipsis") {
    return (
      <span key={`ellipsis-${index}`} class="pagination-ellipsis" aria-hidden="true">
        …
      </span>
    );
  }
  if (item === currentPage) {
    return (
      <span key={item} class="button small is-active" aria-current="page">
        {item}
      </span>
    );
  }
  return <PageNavLink key={item} status={status} page={item} working={working} query={query} />;
}

function PageNav({
  status,
  currentPage,
  totalPages,
  working,
  query,
}: {
  status: TaskStatus;
  currentPage: number;
  totalPages: number;
  working: TaskWorkingFilter | undefined;
  query: string | undefined;
}) {
  if (totalPages <= 1) return null;
  const workingParam = working === undefined ? "" : `&working=${working}`;
  const queryParam = query === undefined ? "" : `&q=${encodeURIComponent(query)}`;
  const href = (page: number) => `/tasks?status=${status}${workingParam}${queryParam}&page=${page}`;
  return (
    <nav class="pagination" aria-label="Task list pages">
      {currentPage > 1 ? (
        <a class="button small" href={href(currentPage - 1)} aria-label="Previous page">
          前へ
        </a>
      ) : (
        <span class="button small is-disabled" aria-disabled="true">
          前へ
        </span>
      )}
      {pageNavItems(currentPage, totalPages).map((item, index) => (
        <PageNavItem
          key={index}
          item={item}
          index={index}
          status={status}
          currentPage={currentPage}
          working={working}
          query={query}
        />
      ))}
      {currentPage < totalPages ? (
        <a class="button small" href={href(currentPage + 1)} aria-label="Next page">
          次へ
        </a>
      ) : (
        <span class="button small is-disabled" aria-disabled="true">
          次へ
        </span>
      )}
    </nav>
  );
}

function projectSearchToken(project: string | null): string {
  return project === null ? "project:none" : `project:${project}`;
}

type TaskListFilterProps = {
  status: TaskStatus;
  working: TaskWorkingFilter | undefined;
  query: string | undefined;
  projects: readonly Project[];
  project: string | null | undefined;
};

function TaskLabelsFilter({
  status,
  working,
  query,
  projects,
  project,
}: TaskListFilterProps) {
  const baseQuery = query ?? `is:${status}`;
  const noneQuery = withQueryToken(baseQuery, "project:", null);
  const queryParam = (value: string) => `&q=${encodeURIComponent(value)}`;
  const labelsHref = (next: TaskWorkingFilter | null) => {
    const nextQuery = withQueryToken(baseQuery, "working:", next === null ? null : `working:${next}`);
    const workingParam = next === null ? "" : `&working=${next}`;
    return `/tasks?status=${status}${workingParam}${queryParam(nextQuery)}`;
  };
  return (
    <details class={working !== undefined || project !== undefined ? "task-label-filter is-active" : "task-label-filter"}>
      <summary class="button small">Labels</summary>
      <div class="task-label-menu">
        <div class="task-label-group-title">Labels</div>
        <a class={working === undefined ? "is-selected" : undefined} href={labelsHref(null)}>
          All labels
        </a>
        <a class={working === "on" ? "is-selected" : undefined} href={labelsHref("on")}>
          working:on
        </a>
        <a class={working === "off" ? "is-selected" : undefined} href={labelsHref("off")}>
          working:off
        </a>
        <div class="task-label-group-title">Projects</div>
        <a class={project === undefined ? "is-selected" : undefined} href={`/tasks?status=${status}${queryParam(noneQuery)}`}>
          All projects
        </a>
        <a
          class={project === null ? "is-selected" : undefined}
          href={`/tasks?status=${status}${queryParam(withQueryToken(baseQuery, "project:", projectSearchToken(null)))}`}
        >
          未分類
        </a>
        {projects.map((candidate) => (
          <a
            key={candidate.id}
            class={project === candidate.id ? "is-selected" : undefined}
            href={`/tasks?status=${status}${queryParam(withQueryToken(baseQuery, "project:", projectSearchToken(candidate.id)))}`}
          >
            {candidate.name}
          </a>
        ))}
      </div>
    </details>
  );
}

function TaskListSearch({
  status,
  working,
  query,
}: {
  status: TaskStatus;
  working: TaskWorkingFilter | undefined;
  query: string;
}) {
  return (
    <form class="task-search" action="/tasks" method="get">
      <input type="hidden" name="status" value={status} />
      {working === undefined ? null : <input type="hidden" name="working" value={working} />}
      <input
        type="search"
        name="q"
        aria-label="Search tasks"
        value={query}
        placeholder="見積もり is:do project:Yoriwake working:on"
      />
      <button class="button small task-search-button" type="submit" aria-label="Submit search" title="Search">
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <circle cx="8.5" cy="8.5" r="5.5" />
          <path d="m13 13 4 4" />
        </svg>
      </button>
    </form>
  );
}

function TaskBulkStatusMenu() {
  return (
    <details class="task-bulk-menu">
      <summary class="button small">Mark as</summary>
      <div class="task-bulk-menu-items">
        {TASK_STATUSES.map((status) => (
          <button type="button" data-task-action={status} key={status}>
            {status}
          </button>
        ))}
      </div>
    </details>
  );
}

function TaskBulkProjectMenu({ projects }: { projects: readonly Project[] }) {
  return (
    <details class="task-bulk-menu">
      <summary class="button small">Project</summary>
      <div class="task-bulk-menu-items">
        <button type="button" data-task-project="" key="none">
          未分類
        </button>
        {projects.map((candidate) => (
          <button type="button" data-task-project={candidate.id} key={candidate.id}>
            {candidate.name}
          </button>
        ))}
      </div>
    </details>
  );
}

function TaskListToolbar({
  hasTasks,
  status,
  working,
  query,
  projects,
  project,
}: { hasTasks: boolean } & TaskListFilterProps) {
  return (
    <>
      <div class="task-list-toolbar">
        <label class="task-select-all">
          <input
            type="checkbox"
            aria-label="Select all tasks on this page"
            data-task-select-all
            disabled={!hasTasks}
          />
        </label>
        <TaskStatusFilter status={status} working={working} />
        <div class="task-bulk-actions">
          <div data-task-bulk-actions>
            <TaskBulkStatusMenu />
            <TaskBulkProjectMenu projects={projects} />
          </div>
          <TaskLabelsFilter
            status={status}
            working={working}
            query={query}
            projects={projects}
            project={project}
          />
          <button
            class="button small button--danger"
            type="button"
            data-task-action="delete"
            data-task-bulk-delete
            disabled
          >
            delete
          </button>
        </div>
      </div>
      <p class="task-selection-feedback" data-task-selection-feedback role="status" hidden></p>
    </>
  );
}

function TaskListRows({ tasks, status }: { tasks: readonly Task[]; status: TaskStatus }) {
  return (
    <div class="list" aria-label="Task list">
      {tasks.length === 0 ? (
        <p class="task-list-empty">該当するtaskはありません。</p>
      ) : (
        tasks.map((task) => <TaskRow key={task.id} task={task} listStatus={status} />)
      )}
    </div>
  );
}

export function TaskListPage({
  tasks,
  status,
  working,
  query,
  currentPage,
  totalPages,
  queryInUrl,
  projects,
  project,
}: {
  tasks: readonly Task[];
  status: TaskStatus;
  working: TaskWorkingFilter | undefined;
  query: string;
  currentPage: number;
  totalPages: number;
  queryInUrl: string | undefined;
  projects: readonly Project[];
  project: string | null | undefined;
}) {
  return (
    <div class="page page--list" data-state="normal">
      <div class="page-header">
        <div>
          <h1 class="page-title">Tasks</h1>
          <p class="muted">GitHub Issues-like task list.</p>
        </div>
        <NewTaskLink project={project} />
      </div>
      <div class="task-list-shell" data-task-list>
        <TaskListSearch status={status} working={working} query={query} />
        <TaskListToolbar
          hasTasks={tasks.length > 0}
          status={status}
          working={working}
          query={queryInUrl}
          projects={projects}
          project={project}
        />
        <TaskListRows tasks={tasks} status={status} />
      </div>
      <PageNav
        status={status}
        currentPage={currentPage}
        totalPages={totalPages}
        working={working}
        query={queryInUrl}
      />
    </div>
  );
}
