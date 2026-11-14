import { describe, expect, it } from "vite-plus/test";
import { Hono } from "hono";
import app from "../src/index";
import { SESSION_COOKIE_NAME, createSession } from "../src/auth";
import { createMemoryOAuthRepository } from "../src/preview/MemoryOAuthRepository";
import { isRecord } from "../src/task";
import { oauthChallenge, recordMcpAudit, verifyMcpToken } from "../src/oauth";
import type { OAuthRepository } from "../src/repository/oauth-repository";
import type { AppEnv, Env } from "../src/app-env";

const SECRET = "oauth-test-secret";
const ORIGIN = "http://localhost";
const VERIFIER = "siftq-test-code-verifier-value-0123456789abcdef";
const REDIRECT_URI = "https://client.example/callback";

async function request(path: string, repository: OAuthRepository, init: RequestInit = {}): Promise<Response> {
  const session = await createSession(SECRET, Date.now() + 60_000);
  const headers = new Headers(init.headers);
  headers.set("Cookie", `${SESSION_COOKIE_NAME}=${session}`);
  const bindings: Env = { SESSION_SECRET: SECRET, OAUTH_REPOSITORY: repository };
  return app.request(path, { ...init, headers }, bindings);
}

function form(body: Record<string, string>): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  };
}

function json(body: unknown): RequestInit {
  return { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

async function jsonBody(response: Response): Promise<Record<string, unknown>> {
  const value: unknown = await response.json();
  return isRecord(value) ? value : {};
}

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...Array.from(bytes)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

async function pkceChallenge(): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(VERIFIER));
  return base64Url(new Uint8Array(digest));
}

async function authorizeQuery(clientId: string, scope: string): Promise<string> {
  const query = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    code_challenge: await pkceChallenge(),
    code_challenge_method: "S256",
    scope,
    state: "st-1",
  });
  return query.toString();
}

async function registerClient(repository: OAuthRepository): Promise<string> {
  const response = await request(
    "/oauth/register",
    repository,
    json({ client_name: "Test Client", redirect_uris: [REDIRECT_URI] }),
  );
  expect(response.status).toBe(201);
  const clientId = (await jsonBody(response))["client_id"];
  expect(typeof clientId).toBe("string");
  return typeof clientId === "string" ? clientId : "";
}

async function authorizeCode(repository: OAuthRepository, clientId: string, scope: string): Promise<string> {
  const response = await request(
    "/oauth/authorize",
    repository,
    form({
      response_type: "code",
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      code_challenge: await pkceChallenge(),
      code_challenge_method: "S256",
      scope,
      state: "st-1",
      decision: "allow",
    }),
  );
  expect(response.status).toBe(302);
  const location = new URL(response.headers.get("location") ?? "");
  const code = location.searchParams.get("code") ?? "";
  expect(code).not.toBe("");
  expect(location.searchParams.get("state")).toBe("st-1");
  return code;
}

function tokenRequest(repository: OAuthRepository, fields: Record<string, string>): Promise<Response> {
  return request("/oauth/token", repository, form(fields));
}

async function exchangeCode(
  repository: OAuthRepository,
  clientId: string,
  scope: string,
): Promise<Record<string, unknown>> {
  const code = await authorizeCode(repository, clientId, scope);
  const response = await tokenRequest(repository, {
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    code_verifier: VERIFIER,
  });
  expect(response.status).toBe(200);
  return jsonBody(response);
}

describe("OAuth metadata", () => {
  it("advertises the protected resource and its scopes", async () => {
    const response = await request("/.well-known/oauth-protected-resource", createMemoryOAuthRepository());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      resource: ORIGIN,
      authorization_servers: [ORIGIN],
      scopes_supported: ["read", "write"],
      bearer_methods_supported: ["header"],
    });
  });

  it("advertises the authorization server endpoints", async () => {
    const response = await request("/.well-known/oauth-authorization-server", createMemoryOAuthRepository());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      issuer: ORIGIN,
      authorization_endpoint: `${ORIGIN}/oauth/authorize`,
      token_endpoint: `${ORIGIN}/oauth/token`,
      registration_endpoint: `${ORIGIN}/oauth/register`,
      revocation_endpoint: `${ORIGIN}/oauth/revoke`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      scopes_supported: ["read", "write"],
    });
  });
});

describe("OAuth dynamic registration", () => {
  it("registers a client and returns its id", async () => {
    const response = await request(
      "/oauth/register",
      createMemoryOAuthRepository(),
      json({ client_name: "Test Client", redirect_uris: [REDIRECT_URI] }),
    );

    expect(response.status).toBe(201);
    const body = await jsonBody(response);
    expect(body["client_name"]).toBe("Test Client");
    expect(body["redirect_uris"]).toEqual([REDIRECT_URI]);
    expect(body["token_endpoint_auth_method"]).toBe("none");
    expect(typeof body["client_id"]).toBe("string");
  });

  it("rejects an http redirect_uri that is not loopback", async () => {
    const response = await request(
      "/oauth/register",
      createMemoryOAuthRepository(),
      json({ client_name: "Bad Client", redirect_uris: ["http://evil.example/callback"] }),
    );

    expect(response.status).toBe(400);
    expect((await jsonBody(response))["error"]).toBe("invalid_redirect_uri");
  });

  it("rejects an empty redirect_uris list", async () => {
    const response = await request(
      "/oauth/register",
      createMemoryOAuthRepository(),
      json({ client_name: "Bad Client", redirect_uris: [] }),
    );

    expect(response.status).toBe(400);
  });

  it("accepts a loopback http redirect_uri", async () => {
    const response = await request(
      "/oauth/register",
      createMemoryOAuthRepository(),
      json({ client_name: "Local Client", redirect_uris: ["http://127.0.0.1:7777/callback"] }),
    );

    expect(response.status).toBe(201);
  });
});

describe("OAuth authorize", () => {
  it("renders a consent screen naming the client and the scopes", async () => {
    const repository = createMemoryOAuthRepository();
    const clientId = await registerClient(repository);
    const response = await request(`/oauth/authorize?${await authorizeQuery(clientId, "read write")}`, repository);

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("Test Client");
    expect(html).toContain("削除を含む");
    expect(html).toContain('name="decision"');
  });

  it("rejects an unsupported scope without redirecting", async () => {
    const repository = createMemoryOAuthRepository();
    const clientId = await registerClient(repository);
    const response = await request(`/oauth/authorize?${await authorizeQuery(clientId, "admin")}`, repository);

    expect(response.status).toBe(400);
    expect((await jsonBody(response))["error"]).toBe("invalid_scope");
  });

  it("redirects with access_denied when the user refuses", async () => {
    const repository = createMemoryOAuthRepository();
    const clientId = await registerClient(repository);
    const response = await request(
      "/oauth/authorize",
      repository,
      form({
        response_type: "code",
        client_id: clientId,
        redirect_uri: REDIRECT_URI,
        code_challenge: await pkceChallenge(),
        code_challenge_method: "S256",
        scope: "read",
        state: "st-1",
        decision: "deny",
      }),
    );

    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.searchParams.get("error")).toBe("access_denied");
    expect(location.searchParams.get("state")).toBe("st-1");
  });
});

describe("OAuth token exchange", () => {
  it("issues access and refresh tokens for an authorization code", async () => {
    const repository = createMemoryOAuthRepository();
    const clientId = await registerClient(repository);
    const payload = await exchangeCode(repository, clientId, "read write");

    expect(payload["token_type"]).toBe("Bearer");
    expect(payload["expires_in"]).toBe(3600);
    expect(payload["scope"]).toBe("read write");
    expect(typeof payload["refresh_token"]).toBe("string");
    const info = await verifyMcpToken(
      { OAUTH_REPOSITORY: repository },
      `Bearer ${String(payload["access_token"])}`,
    );
    expect(info).toEqual({ clientId, clientName: "Test Client", scopes: ["read", "write"] });
  });

  it("grants only read when only read is requested", async () => {
    const repository = createMemoryOAuthRepository();
    const clientId = await registerClient(repository);
    const payload = await exchangeCode(repository, clientId, "read");

    expect(payload["scope"]).toBe("read");
    const info = await verifyMcpToken(
      { OAUTH_REPOSITORY: repository },
      `Bearer ${String(payload["access_token"])}`,
    );
    expect(info?.scopes).toEqual(["read"]);
  });

  it("rejects a wrong code_verifier with invalid_grant", async () => {
    const repository = createMemoryOAuthRepository();
    const clientId = await registerClient(repository);
    const code = await authorizeCode(repository, clientId, "read");
    const response = await tokenRequest(repository, {
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      code_verifier: "wrong-verifier",
    });

    expect(response.status).toBe(400);
    expect((await jsonBody(response))["error"]).toBe("invalid_grant");
  });
});

describe("OAuth token request formats", () => {
  it("accepts a JSON token request", async () => {
    const repository = createMemoryOAuthRepository();
    const clientId = await registerClient(repository);
    const code = await authorizeCode(repository, clientId, "read");
    const response = await request(
      "/oauth/token",
      repository,
      json({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        redirect_uri: REDIRECT_URI,
        code_verifier: VERIFIER,
      }),
    );

    expect(response.status).toBe(200);
    expect(typeof (await jsonBody(response))["access_token"]).toBe("string");
  });
});

describe("OAuth code and refresh reuse", () => {
  it("does not exchange the same code twice", async () => {
    const repository = createMemoryOAuthRepository();
    const clientId = await registerClient(repository);
    const code = await authorizeCode(repository, clientId, "read");
    const fields = {
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      code_verifier: VERIFIER,
    };

    expect((await tokenRequest(repository, fields)).status).toBe(200);
    const replay = await tokenRequest(repository, fields);
    expect(replay.status).toBe(400);
    expect((await jsonBody(replay))["error"]).toBe("invalid_grant");
  });

  it("rotates the refresh token and rejects the previous one", async () => {
    const repository = createMemoryOAuthRepository();
    const clientId = await registerClient(repository);
    const first = await exchangeCode(repository, clientId, "read");
    const refreshToken = String(first["refresh_token"]);

    const rotated = await tokenRequest(repository, {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
    });
    expect(rotated.status).toBe(200);
    const second = await jsonBody(rotated);
    expect(second["refresh_token"]).not.toBe(refreshToken);
    expect(typeof second["access_token"]).toBe("string");

    const reused = await tokenRequest(repository, {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
    });
    expect(reused.status).toBe(400);
    expect((await jsonBody(reused))["error"]).toBe("invalid_grant");
  });
});

describe("OAuth revocation", () => {
  it("stops accepting an access token after revocation", async () => {
    const repository = createMemoryOAuthRepository();
    const clientId = await registerClient(repository);
    const payload = await exchangeCode(repository, clientId, "read");
    const accessToken = String(payload["access_token"]);

    const response = await request("/oauth/revoke", repository, form({ token: accessToken }));
    expect(response.status).toBe(200);
    expect(await verifyMcpToken({ OAUTH_REPOSITORY: repository }, `Bearer ${accessToken}`)).toBeNull();
  });

  it("lists linked clients and revokes every token of a client", async () => {
    const repository = createMemoryOAuthRepository();
    const clientId = await registerClient(repository);
    const payload = await exchangeCode(repository, clientId, "read");
    const accessToken = String(payload["access_token"]);

    const page = await request("/connections", repository);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain("Test Client");
    expect(html).toContain("有効なトークン");

    const revoked = await request("/connections/revoke", repository, form({ client_id: clientId }));
    expect(revoked.status).toBe(302);
    expect(revoked.headers.get("location")).toBe("/connections");
    expect(await verifyMcpToken({ OAUTH_REPOSITORY: repository }, `Bearer ${accessToken}`)).toBeNull();
  });
});

describe("MCP challenge and audit", () => {
  it("points the WWW-Authenticate challenge at the protected resource metadata", async () => {
    const probe = new Hono<AppEnv>();
    probe.get("/challenge", (c) => c.text(oauthChallenge(c)));

    const response = await probe.request("/challenge");

    expect(await response.text()).toBe(
      `Bearer resource_metadata="${ORIGIN}/.well-known/oauth-protected-resource"`,
    );
  });

  it("never throws when the audit store fails", async () => {
    const failing: OAuthRepository = {
      ...createMemoryOAuthRepository(),
      insertAudit: async () => {
        throw new Error("audit store unavailable");
      },
    };

    await expect(
      recordMcpAudit({ OAUTH_REPOSITORY: failing }, { clientId: "client-1", tool: "tasks_list", status: "ok" }),
    ).resolves.toBeUndefined();
  });
});
