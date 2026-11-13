import { err, ok } from "../task";
import type { Result } from "../task";
import { sortProjects } from "../project";
import type { Project } from "../project";
import type {
  ProjectOrderUpdate,
  ProjectRepository,
  ProjectRepositoryError,
} from "../repository/project-repository";

export function createMemoryProjectRepository(
  initialProjects: readonly Project[] = [],
): ProjectRepository {
  const projects = new Map(initialProjects.map((project) => [project.id, project]));

  async function list(): Promise<Result<Project[], ProjectRepositoryError>> {
    return ok(sortProjects([...projects.values()]));
  }

  async function find(id: string): Promise<Result<Project | undefined, ProjectRepositoryError>> {
    return ok(projects.get(id));
  }

  async function move(
    updates: readonly ProjectOrderUpdate[],
  ): Promise<Result<Project[], ProjectRepositoryError>> {
    const changed: Project[] = [];
    for (const update of updates) {
      const project = projects.get(update.id);
      if (project === undefined) return err({ code: "INVALID_PROJECT" });
      changed.push({ ...project, sort_order: update.order });
    }
    for (const project of changed) projects.set(project.id, project);
    return list();
  }

  return { list, find, move };
}
