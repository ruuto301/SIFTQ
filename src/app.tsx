import { Hono } from "hono";
import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import { CLIENT_ASSETS, CLIENT_ASSET_PATHS } from "./client/scripts";
import { SESSION_COOKIE_NAME, isValidSession } from "./auth";
import { createD1TaskRepository } from "./repository/d1-task-repository";
import type { TaskRepository } from "./repository/task-repository";
import { createD1IdeaRepository } from "./repository/d1-idea-repository";
import type { IdeaRepository } from "./repository/idea-repository";
import { createD1ImageRepository, createMemoryImageRepository } from "./repository/image-repository";
import type { ImageRepository } from "./repository/image-repository";
import { createMemoryTaskRepository } from "./preview/MemoryTaskRepository";
import { createMemoryIdeaRepository } from "./preview/MemoryIdeaRepository";
import { PREVIEW_TASKS } from "./preview/tasks";
import { PREVIEW_IDEAS } from "./preview/ideas";
import { registerAuthRoutes } from "./routes/auth";
import { registerTaskApiRoutes } from "./routes/task-api";
import { registerIdeaApiRoutes } from "./routes/idea-api";
import { registerImageApiRoutes } from "./routes/image-api";
import { registerTaskScreenRoutes } from "./routes/task-screens";
import type { AppEnv } from "./app-env";

const app = new Hono<AppEnv>();
const previewRepository = createMemoryTaskRepository(PREVIEW_TASKS);
const previewIdeaRepository = createMemoryIdeaRepository(PREVIEW_IDEAS);
const previewImageRepository = createMemoryImageRepository();

const PUBLIC_PATHS = new Set([
  "/login",
  "/auth/github",
  "/auth/github/callback",
  ...CLIENT_ASSET_PATHS,
]);

function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.has(path);
}

function sessionSecret(c: Context<AppEnv>): string | null {
  return c.env.SESSION_SECRET ?? null;
}

function unauthorizedResponse(c: Context<AppEnv>): Response {
  if (c.req.path.startsWith("/api/")) {
    return c.json(
      {
        type: "about:blank",
        title: "Unauthorized",
        status: 401,
        code: "UNAUTHORIZED",
      },
      401,
    );
  }
  if (c.req.header("HX-Request") === "true") {
    c.header("HX-Redirect", "/login");
    return c.body(null, 401);
  }
  return c.redirect("/login");
}

app.use("*", async (c, next) => {
  if (isPublicPath(c.req.path)) return next();
  const secret = sessionSecret(c);
  if (secret === null) return c.text("Authentication is not configured", 503);
  const session = getCookie(c, SESSION_COOKIE_NAME);
  if (session !== undefined && (await isValidSession(secret, session))) return next();
  return unauthorizedResponse(c);
});

registerAuthRoutes(app);

function repository(c: Context<AppEnv>): TaskRepository {
  if (c.env.PREVIEW_MODE === "true") return previewRepository;
  if (c.env.TASK_REPOSITORY) return c.env.TASK_REPOSITORY;
  if (c.env.DB) return createD1TaskRepository(c.env.DB);
  throw new Error("task repository is not configured");
}

function ideaRepository(c: Context<AppEnv>): IdeaRepository {
  if (c.env.PREVIEW_MODE === "true") return previewIdeaRepository;
  if (c.env.IDEA_REPOSITORY) return c.env.IDEA_REPOSITORY;
  if (c.env.DB) return createD1IdeaRepository(c.env.DB);
  throw new Error("idea repository is not configured");
}

function imageRepository(c: Context<AppEnv>): ImageRepository {
  if (c.env.PREVIEW_MODE === "true") return previewImageRepository;
  if (c.env.IMAGE_REPOSITORY) return c.env.IMAGE_REPOSITORY;
  if (c.env.DB) return createD1ImageRepository(c.env.DB);
  throw new Error("image repository is not configured");
}

registerTaskApiRoutes(app, repository);
registerIdeaApiRoutes(app, ideaRepository);
registerImageApiRoutes(app, imageRepository);
registerTaskScreenRoutes(app, repository, ideaRepository);

for (const asset of CLIENT_ASSETS) {
  app.get(asset.path, (c) => c.body(asset.body, 200, { "content-type": asset.contentType }));
}

export default app;
