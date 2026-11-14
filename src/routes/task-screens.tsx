import type { Context, Hono } from "hono";
import type { JSX } from "hono/jsx/jsx-runtime";
import {
  Layout,
} from "../components/Layout";
import { OptionMenu } from "../components/OptionMenu";
import { TaskMeta } from "../components/TaskMeta";
import type { NewTaskState } from "../components/NewTaskMeta";
import { IdeasPage } from "../views/IdeasPage";
import { IdeaDetailPage } from "../views/IdeaDetailPage";
import { DshChatPage } from "../views/DshChatPage";
import { DsPage } from "../views/DsPage";
import { TaskListPage } from "../views/TaskListPage";
import { NewTaskForm, TaskDetailPage, TaskVersionInput } from "../views/TaskFormPage";
import { pageNav } from "../views/navigation";
import { NAV_SCREENS } from "../screens";
import { changeTaskProject, changeTaskStatus, changeTaskWorking, createTask, err, isTaskStatus, is_working, nextTaskOrder } from "../task";
import type { DomainError, Result, Task, TaskStatus } from "../task";
import type { Project } from "../project";
import {
  TASK_STATUS_FILTERS,
  filterTasks,
  groupTasksByProject,
  paginateTasks,
  parsePageParam,
  parseTaskListQuery,
  sortTasksByOrder,
  taskProjectFilter,
} from "../task-list";
import type { TaskListQuery } from "../task-list";
import {
  isInvalidTaskDescription,
  isInvalidTaskTitle,
  parseTaskProject,
  parseTaskVersion,
  readTaskFields,
} from "../task-input";
import type { ParsedBody } from "../task-input";
import type { AppEnv } from "../app-env";
import type { TaskRepository } from "../repository/task-repository";
import type { ProjectRepository } from "../repository/project-repository";
import type { IdeaRepository } from "../repository/idea-repository";

type Repository = (c: Context<AppEnv>) => TaskRepository;
type ProjectRepositoryFactory = (c: Context<AppEnv>) => ProjectRepository;
type IdeaRepositoryFactory = (c: Context<AppEnv>) => IdeaRepository;

function activePage(path: string): "ideas" | "tasks" | "ds" {
  const match = NAV_SCREENS.find((screen) => path === screen.path || path.startsWith(`${screen.path}/`));
  return match?.activeKey ?? "tasks";
}

function renderPage(c: Context<AppEnv>, content: JSX.Element) {
  if (c.req.header("HX-Request")) return c.html(content);
  return c.html(<Layout active={activePage(c.req.path)}>{content}</Layout>);
}

function createTaskAtBoundary({
  title,
  description,
  status,
  project,
}: {
  title: string;
  description: string;
  status?: TaskStatus;
  project?: string | null;
}) {
  const now = new Date().toISOString();
  return createTask({
    id: crypto.randomUUID(),
    owner_id: "local",
    title,
    description,
    ...(status === undefined ? {} : { status }),
    ...(project === undefined ? {} : { project }),
    created_at: now,
    updated_at: now,
  });
}

async function findTask(c: Context<AppEnv>, repository: Repository, id: string): Promise<Task | undefined> {
  const result = await repository(c).find(id, "local");
  return result.ok ? result.value : undefined;
}

async function persistTask(c: Context<AppEnv>, repository: Repository, updated: Task): Promise<Task | null> {
  const result = await repository(c).update(updated);
  return result.ok ? result.value : null;
}

async function knownProjects(c: Context<AppEnv>, projectRepository: ProjectRepositoryFactory) {
  const result = await projectRepository(c).list();
  return result.ok ? result.value : null;
}

async function projectExists(
  c: Context<AppEnv>,
  projectRepository: ProjectRepositoryFactory,
  id: string,
): Promise<boolean> {
  const result = await projectRepository(c).find(id);
  return result.ok && result.value !== undefined;
}

async function routeTask(c: Context<AppEnv>, repository: Repository): Promise<Task | undefined> {
  const id = c.req.param("id");
  return id === undefined ? undefined : findTask(c, repository, id);
}

type LoadedTask = { task: Task; projects: Project[] };

/** Loads the :id task with the project list, or null when either lookup fails. */
async function loadTaskAndProjects(
  c: Context<AppEnv>,
  repository: Repository,
  projectRepository: ProjectRepositoryFactory,
): Promise<LoadedTask | null> {
  const task = await routeTask(c, repository);
  const projects = await knownProjects(c, projectRepository);
  if (task === undefined || projects === null) return null;
  return { task, projects };
}

/** Query default project for the new task screen. Unknown ids fall back to 未分類. */
async function newTaskProject(
  c: Context<AppEnv>,
  projectRepository: ProjectRepositoryFactory,
): Promise<string | null> {
  const requested = parseTaskProject(c.req.query("project"));
  if (requested === undefined || requested === null) return null;
  return (await projectExists(c, projectRepository, requested)) ? requested : null;
}

function taskTextError(title: string, description: string): string | undefined {
  if (isInvalidTaskTitle(title)) return "Title is required and must be 256 characters or fewer.";
  if (isInvalidTaskDescription(description)) return "Description must be 16,384 characters or fewer.";
  return undefined;
}

function detailListStatus(c: Context<AppEnv>): TaskStatus {
  const status = c.req.query("status");
  return isTaskStatus(status) ? status : "do";
}

function ConflictPage({ taskId }: { taskId: string }) {
  return (
    <div class="error">
      <p>Task was updated elsewhere.</p>
      <a {...pageNav(`/tasks/${taskId}`)}>Load latest</a>
    </div>
  );
}

function registerTaskListRoutes(app: Hono<AppEnv>, ideaRepository: IdeaRepositoryFactory) {
  app.get("/", (c) => c.redirect("/ideas"));

  app.get("/matrix", (c) => c.redirect("/tasks", 301));

  app.get("/ideas", async (c) => {
    const result = await ideaRepository(c).list("local");
    if (!result.ok) return c.text("Internal Server Error", 500);
    return renderPage(c, <IdeasPage ideas={result.value} />);
  });

  app.get("/ideas/:id", async (c) => {
    const result = await ideaRepository(c).find(c.req.param("id"), "local");
    if (!result.ok) return c.text("Internal Server Error", 500);
    return result.value === undefined ? c.notFound() : renderPage(c, <IdeaDetailPage idea={result.value} />);
  });
}

function registerTaskListViewRoute(
  app: Hono<AppEnv>,
  repository: Repository,
  projectRepository: ProjectRepositoryFactory,
) {
  app.get("/tasks", async (c) => {
    const result = await repository(c).list();
    const projectList = await knownProjects(c, projectRepository);
    if (!result.ok || projectList === null) return c.text("Internal Server Error", 500);
    const rawStatus = c.req.query("status");
    const rawQuery = c.req.query("q");
    const parsedQuery: TaskListQuery | null = parseTaskListQuery(rawQuery);
    let status: TaskStatus = "do";
    if (parsedQuery !== null) status = parsedQuery.status;
    else if (isTaskStatus(rawStatus)) status = rawStatus;
    let workingOnly = c.req.query("working") === "only";
    if (parsedQuery !== null) workingOnly = parsedQuery.workingOnly;
    const project = parsedQuery?.project;
    let query = `is:${status}`;
    if (workingOnly) query += " label:working";
    if (parsedQuery !== null && rawQuery !== undefined) query = rawQuery.trim();
    const filteredTasks = filterTasks(result.value, [
      TASK_STATUS_FILTERS[status],
      ...(workingOnly ? [is_working] : []),
      ...(project === undefined ? [] : [taskProjectFilter(project)]),
    ]);
    const requestedPage = parsePageParam(c.req.query("page")) ?? 1;
    const { pageTasks, currentPage, totalPages } = paginateTasks(filteredTasks, requestedPage);
    return renderPage(
      c,
      <TaskListPage
        tasks={pageTasks}
        status={status}
        workingOnly={workingOnly}
        query={query}
        currentPage={currentPage}
        totalPages={totalPages}
        queryInUrl={rawQuery}
        projects={projectList}
        project={project}
      />,
    );
  });
}

function registerTaskDetailRoutes(
  app: Hono<AppEnv>,
  repository: Repository,
  projectRepository: ProjectRepositoryFactory,
) {
  app.get("/tasks/new", async (c) => {
    const projects = await knownProjects(c, projectRepository);
    if (projects === null) return c.text("Internal Server Error", 500);
    const rawStatus = c.req.query("status");
    const state: NewTaskState = {
      status: isTaskStatus(rawStatus) ? rawStatus : "do",
      project: await newTaskProject(c, projectRepository),
    };
    return renderPage(c, <NewTaskForm state={state} projects={projects} />);
  });

  app.get("/tasks/:id", async (c) => {
    const loaded = await loadTaskAndProjects(c, repository, projectRepository);
    if (loaded === null) return c.notFound();
    return renderPage(
      c,
      <TaskDetailPage task={loaded.task} projects={loaded.projects} listStatus={detailListStatus(c)} />,
    );
  });

  app.get("/tasks/:id/chat", async (c) => {
    const task = await routeTask(c, repository);
    if (task === undefined) return c.notFound();
    const wsUrl = c.env.DSH_TRANSPORT_URL ?? "ws://127.0.0.1:8799";
    const workspace = c.env.DSH_WORKSPACE ?? "/mnt/c/projects";
    return renderPage(c, <DshChatPage task={task} wsUrl={wsUrl} workspace={workspace} />);
  });

  app.get("/tasks/:id/status/menu", async (c) => {
    const loaded = await loadTaskAndProjects(c, repository, projectRepository);
    if (loaded === null) return c.notFound();
    return c.html(<OptionMenu task={loaded.task} projects={loaded.projects} listStatus={detailListStatus(c)} />);
  });
}

function registerTaskCreateRoute(
  app: Hono<AppEnv>,
  repository: Repository,
  projectRepository: ProjectRepositoryFactory,
) {
  app.post("/tasks", async (c) => {
    const body = await c.req.parseBody();
    const projects = await knownProjects(c, projectRepository);
    if (projects === null) return c.text("Internal Server Error", 500);
    const { title, description } = readTaskFields(body);
    const requested = parseTaskProject(body["project"]);
    const state: NewTaskState = {
      status: isTaskStatus(body["status"]) ? body["status"] : "do",
      project: requested === undefined ? null : requested,
    };
    const error = taskTextError(title, description);
    if (error !== undefined) return c.html(<NewTaskForm state={state} projects={projects} error={error} />);
    if (state.project !== null && !(await projectExists(c, projectRepository, state.project))) {
      return c.html(<NewTaskForm state={state} projects={projects} error="Unknown project." />);
    }
    const created = createTaskAtBoundary({
      title,
      description,
      status: state.status,
      project: state.project,
    });
    if (!created.ok) return c.text(`Invalid task: ${created.error.code}`, 400);
    const listed = await repository(c).list();
    if (!listed.ok) return c.text("Internal Server Error", 500);
    const inserted = await repository(c).insert({ ...created.value, order: nextTaskOrder(listed.value) });
    if (!inserted.ok) return c.text("Internal Server Error", 500);
    c.header("HX-Redirect", "/tasks");
    return c.body(null, 201);
  });
}

async function handleTaskUpdate(
  c: Context<AppEnv>,
  repository: Repository,
  projectRepository: ProjectRepositoryFactory,
) {
  const loaded = await loadTaskAndProjects(c, repository, projectRepository);
  if (loaded === null) return c.notFound();
  const { task, projects } = loaded;
  const body = await c.req.parseBody();
  const { title, description } = readTaskFields(body);
  const version = parseTaskVersion(body["version"]);
  if (version === null) return c.text("Invalid version", 400);
  const error = taskTextError(title, description);
  if (error !== undefined) {
    return c.html(<TaskDetailPage task={task} projects={projects} error={error} listStatus={detailListStatus(c)} />);
  }
  const saved = await persistTask(c, repository, { ...task, title, description, version });
  if (saved === null) return c.html(<ConflictPage taskId={task.id} />, 409);
  if (c.req.header("HX-Request")) {
    c.header("HX-Redirect", "/tasks");
    return c.body(null);
  }
  return c.redirect("/tasks");
}

async function readTaskForm(
  c: Context<AppEnv>,
  repository: Repository,
): Promise<{ task: Task; body: ParsedBody } | null> {
  const task = await routeTask(c, repository);
  if (task === undefined) return null;
  return { task, body: await c.req.parseBody() };
}

type MetaAction = "status" | "project" | "working";

function applyMetaChange(action: MetaAction, task: Task, body: ParsedBody): Result<Task, DomainError> {
  if (action === "status") {
    const status = body["status"];
    return isTaskStatus(status) ? changeTaskStatus(task, status) : err({ code: "INVALID_STATUS" });
  }
  if (action === "project") {
    const project = parseTaskProject(body["project"]);
    return project === undefined ? err({ code: "INVALID_PROJECT" }) : changeTaskProject(task, project);
  }
  const working = body["working"];
  return working === "true" || working === "false"
    ? changeTaskWorking(task, working === "true")
    : err({ code: "INVALID_WORKING" });
}

async function handleTaskMetaChange(
  c: Context<AppEnv>,
  action: MetaAction,
  repository: Repository,
  projectRepository: ProjectRepositoryFactory,
) {
  const form = await readTaskForm(c, repository);
  if (form === null) return c.notFound();
  const version = parseTaskVersion(form.body["version"]);
  if (version === null) return c.text("Invalid version", 400);
  const changed = applyMetaChange(action, form.task, form.body);
  if (!changed.ok) return c.text(`Invalid ${action}`, 400);
  if (
    action === "project" &&
    changed.value.project !== null &&
    !(await projectExists(c, projectRepository, changed.value.project))
  ) {
    return c.text("Invalid project", 400);
  }
  return updateTaskMeta(c, repository, projectRepository, form.task, { ...changed.value, version }, detailListStatus(c));
}

function registerTaskEditRoutes(
  app: Hono<AppEnv>,
  repository: Repository,
  projectRepository: ProjectRepositoryFactory,
) {
  app.post("/tasks/:id", (c) => handleTaskUpdate(c, repository, projectRepository));
  app.post("/tasks/:id/status", (c) => handleTaskMetaChange(c, "status", repository, projectRepository));
  app.post("/tasks/:id/project", (c) => handleTaskMetaChange(c, "project", repository, projectRepository));
  app.post("/tasks/:id/working", (c) => handleTaskMetaChange(c, "working", repository, projectRepository));
}

function registerDsRoute(
  app: Hono<AppEnv>,
  repository: Repository,
  projectRepository: ProjectRepositoryFactory,
) {
  app.get("/ds", async (c) => {
    const result = await repository(c).list();
    const projects = await knownProjects(c, projectRepository);
    if (!result.ok || projects === null) return c.text("Internal Server Error", 500);
    const rawStatus = c.req.query("status");
    const status: TaskStatus = isTaskStatus(rawStatus) ? rawStatus : "do";
    const tasks = result.value.filter((task) => task.status === status);
    const groups = groupTasksByProject(sortTasksByOrder(tasks), projects);
    const requested = c.req.query("task");
    const selected = tasks.find((task) => task.id === requested) ?? tasks[0];
    const wsUrl = c.env.DSH_TRANSPORT_URL ?? "ws://127.0.0.1:8799";
    const workspace = c.env.DSH_WORKSPACE ?? "/mnt/c/projects";
    return renderPage(
      c,
      <DsPage groups={groups} projects={projects} selected={selected} status={status} wsUrl={wsUrl} workspace={workspace} />,
    );
  });
}

export function registerTaskScreenRoutes(
  app: Hono<AppEnv>,
  repository: Repository,
  ideaRepository: IdeaRepositoryFactory,
  projectRepository: ProjectRepositoryFactory,
) {
  registerTaskListRoutes(app, ideaRepository);
  registerTaskListViewRoute(app, repository, projectRepository);
  registerDsRoute(app, repository, projectRepository);
  registerTaskDetailRoutes(app, repository, projectRepository);
  registerTaskCreateRoute(app, repository, projectRepository);
  registerTaskEditRoutes(app, repository, projectRepository);
}

async function updateTaskMeta(
  c: Context<AppEnv>,
  repository: Repository,
  projectRepository: ProjectRepositoryFactory,
  task: Task,
  updated: Task,
  listStatus: TaskStatus,
) {
  const saved = await persistTask(c, repository, updated);
  const projects = await knownProjects(c, projectRepository);
  if (saved === null) return c.html(<ConflictPage taskId={task.id} />, 409);
  if (projects === null) return c.text("Internal Server Error", 500);
  return c.html(
    <>
      <TaskMeta task={saved} projects={projects} listStatus={listStatus} />
      <TaskVersionInput version={saved.version} outOfBand />
    </>,
  );
}
