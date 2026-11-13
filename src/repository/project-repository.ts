import type { DomainError, Result } from "../task";
import type { Project } from "../project";

export type ProjectRepositoryError = DomainError;

export type ProjectOrderUpdate = {
  id: string;
  order: number;
};

export interface ProjectRepository {
  list(): Promise<Result<Project[], ProjectRepositoryError>>;
  find(id: string): Promise<Result<Project | undefined, ProjectRepositoryError>>;
  move(updates: readonly ProjectOrderUpdate[]): Promise<Result<Project[], ProjectRepositoryError>>;
}
