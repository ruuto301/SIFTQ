import type { D1Database } from "@cloudflare/workers-types";
import type { TaskRepository } from "./repository/task-repository";
import type { ProjectRepository } from "./repository/project-repository";
import type { IdeaRepository } from "./repository/idea-repository";
import type { ImageRepository } from "./repository/image-repository";
import type { OAuthRepository } from "./repository/oauth-repository";
import type { GithubOAuthEnv } from "./github-oauth";

export type Env = GithubOAuthEnv & {
  TASK_REPOSITORY?: TaskRepository;
  PROJECT_REPOSITORY?: ProjectRepository;
  IDEA_REPOSITORY?: IdeaRepository;
  IMAGE_REPOSITORY?: ImageRepository;
  OAUTH_REPOSITORY?: OAuthRepository;
  DB?: D1Database;
  SESSION_SECRET?: string;
  PREVIEW_MODE?: string;
  DSH_TRANSPORT_URL?: string;
  DSH_WORKSPACE?: string;
  DSH_INTERNAL_TOKEN?: string;
};

export type AppEnv = {
  Bindings: Env;
};
