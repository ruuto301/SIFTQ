export type ActiveKey = "ideas" | "matrix" | "tasks";

type Nav = {
  label: string;
  order: number;
  activeKey: ActiveKey;
};

export type Screen = {
  path: string;
  pageId?: string;
  entity?: string;
  presentationId?: string;
  clientFiles?: readonly string[];
  nav?: Nav;
};

export const SCREENS: readonly Screen[] = [
  { path: "/login", pageId: "html_login_page" },
  {
    path: "/matrix",
    pageId: "html_matrix_page",
    entity: "tasks",
    presentationId: "P01",
    clientFiles: ["matrix-scripts.ts"],
    nav: { label: "Matrix", order: 1, activeKey: "matrix" },
  },
  {
    path: "/tasks",
    pageId: "html_tasks_page",
    entity: "tasks",
    presentationId: "P02",
    clientFiles: ["task-list-scripts.ts"],
    nav: { label: "Tasks", order: 2, activeKey: "tasks" },
  },
  {
    path: "/tasks/:id",
    pageId: "html_task_page",
    entity: "tasks",
    presentationId: "P03",
    clientFiles: ["task-form-scripts.ts"],
  },
  {
    path: "/tasks/new",
    pageId: "html_new_task_page",
    presentationId: "P04",
    clientFiles: ["task-form-scripts.ts"],
  },
  {
    path: "/ideas",
    pageId: "html_ideas_page",
    entity: "ideas",
    presentationId: "P08",
    clientFiles: ["idea-scripts.ts"],
    nav: { label: "Ideas", order: 0, activeKey: "ideas" },
  },
  { path: "/ideas/:id", pageId: "html_ideas_detail", entity: "ideas", presentationId: "P09" },
];

export type NavItem = { path: string; label: string; activeKey: ActiveKey };

export const NAV_SCREENS: readonly NavItem[] = SCREENS.flatMap((screen) =>
  screen.nav === undefined
    ? []
    : [{ path: screen.path, label: screen.nav.label, order: screen.nav.order, activeKey: screen.nav.activeKey }],
)
  .sort((a, b) => a.order - b.order)
  .map(({ path, label, activeKey }) => ({ path, label, activeKey }));

export function htmlPageIds(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const screen of SCREENS) {
    if (screen.pageId !== undefined) map[screen.path] = screen.pageId;
  }
  return map;
}

export function pageEntities(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const screen of SCREENS) {
    if (screen.entity !== undefined) map[screen.path] = screen.entity;
  }
  return map;
}

export function screenByFile(): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const screen of SCREENS) {
    if (screen.presentationId === undefined || screen.clientFiles === undefined) continue;
    for (const file of screen.clientFiles) {
      const list = map[file] ?? [];
      list.push(screen.presentationId);
      map[file] = list;
    }
  }
  return map;
}
