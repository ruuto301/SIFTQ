import { describe, expect, it } from "vite-plus/test";
import app from "../../src/index";
import { SESSION_COOKIE_NAME, createSession } from "../../src/auth";
import { TEST_SECRET, authBindings } from "../helpers/authenticated-request";
import { createMemoryTaskRepository } from "../helpers/memory-task-repository";

describe("authentication contract", () => {
  it("redirects unauthenticated HTML to /login", async () => {
    const response = await app.request("/", undefined, authBindings(createMemoryTaskRepository()));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/login");
  });

  it("returns 401 for unauthenticated JSON API", async () => {
    const response = await app.request(
      "/api/tasks",
      undefined,
      authBindings(createMemoryTaskRepository()),
    );

    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("UNAUTHORIZED");
  });

  it("clears the session cookie on logout", async () => {
    const session = await createSession(TEST_SECRET, Date.now() + 60_000);
    const response = await app.request(
      "/logout",
      {
        method: "POST",
        headers: { Cookie: `${SESSION_COOKIE_NAME}=${session}` },
      },
      authBindings(createMemoryTaskRepository()),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/login");
    expect(response.headers.get("set-cookie")).toContain(`${SESSION_COOKIE_NAME}=`);
  });
});
