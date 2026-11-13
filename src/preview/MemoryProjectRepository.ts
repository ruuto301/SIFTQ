import { ok } from "../task";
import type { Result } from "../task";
import { sortProjects } from "../project";
import type { Project } from "../project";
import type { ProjectRepository, ProjectRepositoryError } from "../repository/project-repository";

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

  return { list, find };
}
