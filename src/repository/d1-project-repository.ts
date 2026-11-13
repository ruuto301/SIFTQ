import type { D1Database } from "@cloudflare/workers-types";
import { ok } from "../task";
import type { Result } from "../task";
import { sortProjects, toProject } from "../project";
import type { Project } from "../project";
import type { ProjectRepository, ProjectRepositoryError } from "./project-repository";

const PROJECT_COLUMNS = "id, name, path, sort_order, archived";

export function createD1ProjectRepository(db: D1Database): ProjectRepository {
  return {
    list: () => listProjects(db),
    find: (id) => findProject(db, id),
  };
}

async function listProjects(db: D1Database): Promise<Result<Project[], ProjectRepositoryError>> {
  const result = await db
    .prepare(`SELECT ${PROJECT_COLUMNS} FROM projects ORDER BY sort_order ASC, id ASC`)
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
