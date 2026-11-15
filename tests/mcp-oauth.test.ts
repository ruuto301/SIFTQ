import { describe, expect, it } from "vite-plus/test";
import app from "../src/index";
import { SESSION_COOKIE_NAME, createSession } from "../src/auth";
import { createMemoryOAuthRepository } from "../src/preview/MemoryOAuthRepository";
import { createMemoryTaskRepository } from "../src/preview/MemoryTaskRepository";
import { createMemoryProjectRepository } from "../src/preview/MemoryProjectRepository";
import { createMemoryIdeaRepository } from "../src/preview/MemoryIdeaRepository";
import { PREVIEW_PROJECTS } from "../src/preview/projects";
import { taskFixture } from "./helpers/task-fixture";
import type { Env } from "../src/app-env";
import type { OAuthRepository } from "../src/repository/oauth-repository";

const SECRET = "mcp-oauth-test-secret";
const VERIFIER = "siftq-mcp-code-verifier-value-0123456789abcdef";
const REDIRECT_URI = "https://client.example/callback";

function bindings(oauth: OAuthRepository): Env {
  return {
    SESSION_SECRET: SECRET,
    OAUTH_REPOSITORY: oauth,
    TASK_REPOSITORY: createMemoryTaskRepository([taskFixture({ id: "a", title: "alpha", order: 1 })]),
    PROJECT_REPOSITORY: createMemoryProjectRepository(PREVIEW_PROJECTS),
    IDEA_REPOSITORY: createMemoryIdeaRepository(),
  };
}

function form(body: Record<string, string>): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  };
}

function mcpCall(token: string, body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  };
}

function base64Url(bytes: Uint8Array): string {
  let encoded = btoa(String.fromCharCode(...Array.from(bytes))).replaceAll("+", "-").replaceAll("/", "_");
  while (encoded.endsWith("=")) encoded = encoded.slice(0, -1);
  return encoded;
}

async function pkceChallenge(): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(VERIFIER));
  return base64Url(new Uint8Array(digest));
}

function recordOf(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? { ...value } : {};
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

async function jsonBody(response: Response): Promise<Record<string, unknown>> {
  const value: unknown = await response.json();
  return typeof value === "object" && value !== null ? { ...value } : {};
}

/** Runs register -> consent -> token and returns an access token for the requested scope. */
async function acquireToken(oauth: OAuthRepository, scope: string): Promise<string> {
  const env = bindings(oauth);
  const registered = await app.request(
    "/oauth/register",
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_name: "Test Client", redirect_uris: [REDIRECT_URI] }) },
    env,
  );
  const clientId = String((await jsonBody(registered))["client_id"]);
  const session = await createSession(SECRET, Date.now() + 60_000);
  const consent = await app.request(
    "/oauth/authorize",
    { ...form({ response_type: "code", client_id: clientId, redirect_uri: REDIRECT_URI, code_challenge: await pkceChallenge(), code_challenge_method: "S256", scope, decision: "allow" }), headers: { "content-type": "application/x-www-form-urlencoded", Cookie: `${SESSION_COOKIE_NAME}=${session}` } },
    env,
  );
  const code = new URL(consent.headers.get("location") ?? "").searchParams.get("code") ?? "";
  const token = await app.request(
    "/oauth/token",
    form({ grant_type: "authorization_code", code, client_id: clientId, redirect_uri: REDIRECT_URI, code_verifier: VERIFIER }),
    env,
  );
  return String((await jsonBody(token))["access_token"]);
}

describe("MCP over OAuth (BDD-TM-032)", () => {
  it("lists tools and creates a task with a delegated token", async () => {
    const oauth = createMemoryOAuthRepository();
    const token = await acquireToken(oauth, "read write");

    const initialized = await app.request("/mcp", mcpCall(token, { jsonrpc: "2.0", id: 1, method: "initialize" }), bindings(oauth));
    expect(initialized.status).toBe(200);
    const init = await jsonBody(initialized);
    expect(recordOf(init["result"])["protocolVersion"]).toBe("2025-06-18");

    const listed = await app.request("/mcp", mcpCall(token, { jsonrpc: "2.0", id: 2, method: "tools/list" }), bindings(oauth));
    const tools = recordOf(recordOf(await jsonBody(listed))["result"])["tools"];
    const names = Array.isArray(tools) ? tools.map((tool) => textOf(recordOf(tool)["name"])) : [];
    expect(names).toContain("create_task");

    const created = await app.request(
      "/mcp",
      mcpCall(token, { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "create_task", arguments: { title: "from mcp", position: "first" } } }),
      bindings(oauth),
    );
    expect(created.status).toBe(200);
    const result = recordOf(recordOf(await jsonBody(created))["result"]);
    expect(result["isError"]).toBeUndefined();
    const content = result["content"];
    const first = Array.isArray(content) ? recordOf(content[0]) : {};
    expect(JSON.parse(textOf(first["text"]) === "" ? "null" : textOf(first["text"]))).toMatchObject({
      title: "from mcp",
      order: 1,
    });
  });

  it("keeps a read-only token out of write tools", async () => {
    const oauth = createMemoryOAuthRepository();
    const token = await acquireToken(oauth, "read");
    const denied = await app.request(
      "/mcp",
      mcpCall(token, { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "delete_task", arguments: { id: "a", version: 1 } } }),
      bindings(oauth),
    );
    expect(denied.status).toBe(403);
    const body = await jsonBody(denied);
    expect(recordOf(body["error"])["code"]).toBe(-32003);
  });

  it("answers 405 for GET with a valid token", async () => {
    const oauth = createMemoryOAuthRepository();
    const token = await acquireToken(oauth, "read");
    const response = await app.request("/mcp", { method: "GET", headers: { authorization: `Bearer ${token}` } }, bindings(oauth));
    expect(response.status).toBe(405);
  });
});

describe("MCP token revocation (BDD-TM-033)", () => {
  it("stops accepting the token after it is revoked", async () => {
    const oauth = createMemoryOAuthRepository();
    const token = await acquireToken(oauth, "read write");
    const before = await app.request("/mcp", mcpCall(token, { jsonrpc: "2.0", id: 5, method: "ping" }), bindings(oauth));
    expect(before.status).toBe(200);

    const revoked = await app.request("/oauth/revoke", form({ token }), bindings(oauth));
    expect(revoked.status).toBe(200);
    const after = await app.request("/mcp", mcpCall(token, { jsonrpc: "2.0", id: 6, method: "ping" }), bindings(oauth));
    expect(after.status).toBe(401);
  });
});
