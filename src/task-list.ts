import { isProjectId, sortProjects } from "./project";
import { isTaskStatus } from "./task";
import type { Project } from "./project";
import type { Task, TaskStatus } from "./task";

export type TaskFilter = (task: Task) => boolean;

export type TaskListQuery = {
  status: TaskStatus;
  workingOnly: boolean;
  project: string | null | undefined;
};

type TaskListToken =
  | { kind: "status"; status: TaskStatus }
  | { kind: "working" }
  | { kind: "project"; project: string | null }
  | { kind: "invalid" };

function parseTaskListToken(token: string): TaskListToken {
  if (token.startsWith("is:")) {
    const candidate = token.slice(3);
    return isTaskStatus(candidate) ? { kind: "status", status: candidate } : { kind: "invalid" };
  }
  if (token === "label:working") return { kind: "working" };
  if (token.startsWith("project:")) {
    const candidate = token.slice("project:".length);
    if (candidate === "none") return { kind: "project", project: null };
    return isProjectId(candidate) ? { kind: "project", project: candidate } : { kind: "invalid" };
  }
  return { kind: "invalid" };
}

export type TaskListQueryState = {
  status: TaskStatus | undefined;
  workingOnly: boolean;
  project: string | null | undefined;
};

function applyTaskListToken(state: TaskListQueryState, token: string): boolean {
  const parsed = parseTaskListToken(token);
  if (parsed.kind === "status") {
    if (state.status !== undefined) return false;
    state.status = parsed.status;
    return true;
  }
  if (parsed.kind === "working") {
    if (state.workingOnly) return false;
    state.workingOnly = true;
    return true;
  }
  if (parsed.kind === "project") {
    if (state.project !== undefined) return false;
    state.project = parsed.project;
    return true;
  }
  return false;
}

export function parseTaskListQuery(value: unknown): TaskListQuery | null {
  if (typeof value !== "string" || value.trim() === "") return null;

  const state: TaskListQueryState = { status: undefined, workingOnly: false, project: undefined };
  for (const token of value.trim().split(/\s+/)) {
    if (!applyTaskListToken(state, token)) return null;
  }

  return state.status === undefined
    ? null
    : { status: state.status, workingOnly: state.workingOnly, project: state.project };
}

export function is_do(task: Task): boolean {
  return task.status === "do";
}

export function is_done(task: Task): boolean {
  return task.status === "done";
}

export function is_skip(task: Task): boolean {
  return task.status === "skip";
}

export function taskProjectFilter(project: string | null): TaskFilter {
  return (task) => task.project === project;
}

export const TASK_STATUS_FILTERS: Record<TaskStatus, TaskFilter> = {
  do: is_do,
  done: is_done,
  skip: is_skip,
};

export function filterTasks(tasks: readonly Task[], filters: readonly TaskFilter[]): Task[] {
  return tasks.filter((task) => filters.every((filter) => filter(task)));
}

export function withQueryToken(query: string, prefix: string, token: string | null): string {
  const tokens = query
    .trim()
    .split(/\s+/)
    .filter((value) => value !== "" && !value.startsWith(prefix));
  if (token !== null) tokens.push(token);
  return tokens.join(" ");
}

export type TaskGroup = { project: Project | null; tasks: Task[] };

/** Sorts tasks by the manual `order`, breaking ties by id. */
export function sortTasksByOrder(tasks: readonly Task[]): Task[] {
  return [...tasks].sort(
    (left, right) => left.order - right.order || left.id.localeCompare(right.id),
  );
}

/** Builds the DS left-pane groups: projects by sort_order, then unassigned tasks last. */
export function groupTasksByProject(
  tasks: readonly Task[],
  projects: readonly Project[],
): TaskGroup[] {
  const ordered = sortProjects(projects);
  const known = new Set(ordered.map((project) => project.id));
  const groups: TaskGroup[] = ordered.map((project) => ({
    project,
    tasks: tasks.filter((task) => task.project === project.id),
  }));
  const unassigned = tasks.filter((task) => task.project === null || !known.has(task.project));
  return [...groups, { project: null, tasks: unassigned }];
}

export const TASK_LIST_PAGE_SIZE = 25;

export type PageNavItem = number | "ellipsis";

export function parsePageParam(value: unknown): number | null {
  if (typeof value !== "string" || value === "") return null;
  if (!/^\d+$/.test(value)) return null;
  const page = Number(value);
  if (!Number.isSafeInteger(page) || page < 1) return null;
  return page;
}

export function paginateTasks(
  tasks: readonly Task[],
  page: number,
  pageSize: number = TASK_LIST_PAGE_SIZE,
): { pageTasks: Task[]; currentPage: number; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(tasks.length / pageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const start = (currentPage - 1) * pageSize;
  return { pageTasks: tasks.slice(start, start + pageSize), currentPage, totalPages };
}

export function pageNavItems(currentPage: number, totalPages: number): PageNavItem[] {
  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
  const items: PageNavItem[] = [];
  sorted.forEach((page, index) => {
    const previous = sorted[index - 1];
    if (index > 0 && previous !== undefined && page - previous > 1) items.push("ellipsis");
    items.push(page);
  });
  return items;
}
