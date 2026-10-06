import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import app from "../src/index";
import { OAUTH_STATE_COOKIE_NAME, SESSION_COOKIE_NAME } from "../src/auth";
import type { Env } from "../src/app-env";

const ALLOWED_LOGIN = "octocat";

function bindings(): Env {
  return {
    GITHUB_CLIENT_ID: "client-id",
    GITHUB_CLIENT_SECRET: "client-secret",
    GITHUB_ALLOWED_LOGIN: ALLOWED_LOGIN,
    GITHUB_OAUTH_BASE: "https://github.test",
    GITHUB_API_BASE: "https://api.github.test",
    SESSION_SECRET: "test-secret",
  };
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function stubGithubFetch(login: string): void {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    const url = requestUrl(input);
    if (url.endsWith("/login/oauth/access_token")) {
      return json({ access_token: "access-token" });
    }
    if (url.endsWith("/user")) {
      return json({ login });
    }
    return new Response("not found", { status: 404 });
  });
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function cookieValue(response: Response, name: string): string | null {
  for (const entry of response.headers.getSetCookie()) {
    const pair = entry.split(";")[0] ?? "";
    const separator = pair.indexOf("=");
    if (separator > 0 && pair.slice(0, separator) === name) {
      return pair.slice(separator + 1);
    }
  }
  return null;
}

function cookieHeader(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((entry) => entry.split(";")[0] ?? "")
    .filter((entry) => entry !== "")
    .join("; ");
}

async function callback(state: string): Promise<Response> {
  const start = await app.request("/auth/github", undefined, bindings());
  const issuedState = cookieValue(start, OAUTH_STATE_COOKIE_NAME);
  if (issuedState === null) throw new Error("state cookie was not issued");
  return app.request(
    `/auth/github/callback?code=code&state=${state === "issued" ? issuedState : state}`,
    { headers: { Cookie: cookieHeader(start) } },
    bindings(),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GitHub OAuth login", () => {
  it("redirects to the GitHub authorize endpoint with a state cookie", async () => {
    const response = await app.request("/auth/github", undefined, bindings());

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("https://github.test/login/oauth/authorize");
    expect(response.headers.get("location")).toContain("client_id=client-id");
    expect(cookieValue(response, OAUTH_STATE_COOKIE_NAME)).not.toBeNull();
  });

  it("issues an HttpOnly session cookie and redirects to /ideas after login", async () => {
    stubGithubFetch(ALLOWED_LOGIN);
    const response = await callback("issued");

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/ideas");
    const setCookie = response.headers.getSetCookie().join("\n");
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(setCookie).toContain("HttpOnly");
  });

  it("rejects a GitHub login outside the allowlist", async () => {
    stubGithubFetch("intruder");
    const response = await callback("issued");

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/login?error=1");
    expect(response.headers.getSetCookie().join("\n")).not.toContain(`${SESSION_COOKIE_NAME}=`);
  });

  it("rejects a login that only shares a prefix with an allowlisted login", async () => {
    stubGithubFetch(`${ALLOWED_LOGIN}-evil`);
    const response = await callback("issued");

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/login?error=1");
    expect(response.headers.getSetCookie().join("\n")).not.toContain(`${SESSION_COOKIE_NAME}=`);
  });

  it("rejects a callback whose state does not match the state cookie", async () => {
    stubGithubFetch(ALLOWED_LOGIN);
    const response = await callback("forged");

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/login?error=1");
    expect(response.headers.getSetCookie().join("\n")).not.toContain(`${SESSION_COOKIE_NAME}=`);
  });
});
