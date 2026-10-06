import app from "../../src/index";
import { SESSION_COOKIE_NAME, createSession } from "../../src/auth";
import type { TaskRepository } from "../../src/repository/task-repository";

export const TEST_SECRET = "test-secret";

export function authBindings(repo: TaskRepository): {
  TASK_REPOSITORY: TaskRepository;
  SESSION_SECRET: string;
} {
  return {
    TASK_REPOSITORY: repo,
    SESSION_SECRET: TEST_SECRET,
  };
}

export async function authenticatedRequest(
  path: string,
  repo: TaskRepository,
  init: RequestInit = {},
): Promise<Response> {
  const session = await createSession(TEST_SECRET, Date.now() + 60_000);
  const headers = new Headers(init.headers);
  headers.set("Cookie", `${SESSION_COOKIE_NAME}=${session}`);
  return app.request(path, { ...init, headers }, authBindings(repo));
}
