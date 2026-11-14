import type { D1Database, D1Result } from "@cloudflare/workers-types";
import { err, ok } from "../task";
import type { Result } from "../task";
import { sortProjects, toProject } from "../project";
import type { Project } from "../project";
import type { ProjectOrderUpdate, ProjectRepository, ProjectRepositoryError } from "./project-repository";

const PROJECT_COLUMNS = "id, name, sort_order";

export function createD1ProjectRepository(db: D1Database): ProjectRepository {
  return {
    list: () => listProjects(db),
    find: (id) => findProject(db, id),
    insert: (project) => insertProject(db, project),
    update: (project) => updateProject(db, project),
    remove: (id) => removeProject(db, id),
    move: (updates) => moveProjects(db, updates),
  };
}

async function listProjects(db: D1Database): Promise<Result<Project[], ProjectRepositoryError>> {
  const result = await db
    .prepare(`SELECT ${PROJECT_COLUMNS} FROM projects ORDER BY sort_order ASC, id ASC LIMIT 500`)
    .all<Record<string, unknown>>();
  const projects = result.results
    .map(toProject)
    .filter((project): project is Project => project !== undefined);
  return ok(sortProjects(projects));
}

async function findProject(
  db: D1Database,
  id: string,
): Promise<Result<Project | undefined, ProjectRepositoryError>> {
  const row = await db
    .prepare(`SELECT ${PROJECT_COLUMNS} FROM projects WHERE id = ?`)
    .bind(id)
    .first<Record<string, unknown>>();
  return ok(row === null ? undefined : toProject(row));
}

function changes(result: D1Result): number {
  return result.meta?.changes ?? 0;
}

async function insertProject(db: D1Database, project: Project): Promise<Result<Project, ProjectRepositoryError>> {
  const result = await db
    .prepare("INSERT OR IGNORE INTO projects (id, name, sort_order) VALUES (?, ?, ?)")
    .bind(project.id, project.name, project.sort_order)
    .run();
  return changes(result) === 0 ? err({ code: "CONFLICT" }) : ok(project);
}

async function removeProject(
  db: D1Database,
  id: string,
): Promise<Result<null, ProjectRepositoryError>> {
  const result = await db.prepare("DELETE FROM projects WHERE id = ?").bind(id).run();
  if (changes(result) === 0) return err({ code: "NOT_FOUND" });
  return ok(null);
}

async function updateProject(db: D1Database, project: Project): Promise<Result<Project, ProjectRepositoryError>> {
  const result = await db
    .prepare("UPDATE projects SET name = ?, sort_order = ? WHERE id = ?")
    .bind(project.name, project.sort_order, project.id)
    .run();
  return changes(result) === 0 ? err({ code: "NOT_FOUND" }) : ok(project);
}

async function moveProjects(
  db: D1Database,
  updates: readonly ProjectOrderUpdate[],
): Promise<Result<Project[], ProjectRepositoryError>> {
  const current = await listProjects(db);
  if (!current.ok) return current;
  const known = new Set(current.value.map((project) => project.id));
  if (updates.some((update) => !known.has(update.id))) return err({ code: "INVALID_PROJECT" });
  const results = await db.batch(
    updates.map((update) =>
      db.prepare("UPDATE projects SET sort_order = ? WHERE id = ?").bind(update.order, update.id),
    ),
  );
  if (results.some((result) => changes(result) === 0)) return err({ code: "INVALID_PROJECT" });
  return listProjects(db);
}
