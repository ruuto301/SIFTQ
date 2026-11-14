import type { Context, Hono } from "hono";
import type { AppEnv, Env } from "./app-env";
import { encodeUtf8, timingSafeEqual } from "./crypto";
import { isRecord } from "./task";
import { createD1OAuthRepository } from "./repository/d1-oauth-repository";
import { createMemoryOAuthRepository } from "./preview/MemoryOAuthRepository";
import type { OAuthClient, OAuthRepository, OAuthToken } from "./repository/oauth-repository";
import { ConsentPage } from "./views/ConsentPage";
import { ConnectionsPage } from "./views/ConnectionsPage";
import type { ConnectionView } from "./views/ConnectionsPage";

export type McpScope = "read" | "write";
export type McpTokenInfo = { clientId: string; clientName: string; scopes: McpScope[] };

const ACCESS_TOKEN_PREFIX = "siftq_at_";
const REFRESH_TOKEN_PREFIX = "siftq_rt_";
const CODE_PREFIX = "siftq_code_";
const ACCESS_TOKEN_TTL_SECONDS = 3600;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CODE_TTL_MS = 10 * 60 * 1000;
const PROTECTED_RESOURCE_PATH = "/.well-known/oauth-protected-resource";

const previewOAuthRepository = createMemoryOAuthRepository();

/** Resolves the OAuth store: an injected test repository, then D1, then the preview memory store. */
function oauthRepository(env: Env): OAuthRepository {
  if (env.OAUTH_REPOSITORY) return env.OAUTH_REPOSITORY;
  if (env.DB) return createD1OAuthRepository(env.DB);
  return previewOAuthRepository;
}

function isMcpScope(value: unknown): value is McpScope {
  return value === "read" || value === "write";
}

function base64Url(bytes: Uint8Array): string {
  const binary = String.fromCharCode(...Array.from(bytes));
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encodeUtf8(value)));
}

/** Tokens and codes are persisted as the hex SHA-256 of the value handed to the client. */
async function sha256Hex(value: string): Promise<string> {
  const bytes = await digest(value);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Base64Url(value: string): Promise<string> {
  return base64Url(await digest(value));
}

function randomToken(prefix: string): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `${prefix}${base64Url(bytes)}`;
}

function bearerToken(authorization: string | undefined): string | null {
  if (authorization === undefined) return null;
  const match = /^Bearer (\S+)$/i.exec(authorization.trim());
  return match?.[1] ?? null;
}

function stringField(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key];
  return typeof value === "string" && value !== "" ? value : undefined;
}

function isUsableToken(token: OAuthToken): boolean {
  return token.kind === "access" && token.revoked_at === null && Date.parse(token.expires_at) > Date.now();
}

function isActiveToken(token: OAuthToken): boolean {
  return token.revoked_at === null && Date.parse(token.expires_at) > Date.now();
}

function originOf(c: Context<AppEnv>): string {
  return new URL(c.req.url).origin;
}

/** /mcp の認可に失敗したときの WWW-Authenticate 値。 */
export function oauthChallenge(c: Context<AppEnv>): string {
  const metadata = new URL(PROTECTED_RESOURCE_PATH, c.req.url).toString();
  return `Bearer resource_metadata="${metadata}"`;
}

/** /mcp の Authorization ヘッダを検証する。有効なら McpTokenInfo、無効なら null。 */
export async function verifyMcpToken(env: Env, authorization: string | undefined): Promise<McpTokenInfo | null> {
  const token = bearerToken(authorization);
  if (token === null || !token.startsWith(ACCESS_TOKEN_PREFIX)) return null;

  const repo = oauthRepository(env);
  const found = await repo.findTokenByHash(await sha256Hex(token));
  if (!found.ok || found.value === undefined || !isUsableToken(found.value)) return null;

  const client = await repo.findClient(found.value.client_id);
  if (!client.ok || client.value === undefined) return null;

  return {
    clientId: found.value.client_id,
    clientName: client.value.client_name,
    scopes: found.value.scopes.filter(isMcpScope),
  };
}

/** 監査ログを 1 行記録する（失敗しても例外を投げない）。 */
export async function recordMcpAudit(
  env: Env,
  entry: { clientId: string; tool: string; target?: string | null; status: string },
): Promise<void> {
  try {
    await oauthRepository(env).insertAudit({
      id: crypto.randomUUID(),
      client_id: entry.clientId,
      tool: entry.tool,
      target: entry.target ?? null,
      status: entry.status,
      created_at: new Date().toISOString(),
    });
  } catch {
    // Auditing must never fail the tool call it describes.
  }
}

async function readRequestBody(c: Context<AppEnv>): Promise<Record<string, unknown>> {
  const contentType = c.req.header("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const body = await c.req.json<unknown>();
      return isRecord(body) ? body : {};
    } catch {
      return {};
    }
  }
  try {
    return await c.req.parseBody();
  } catch {
    return {};
  }
}

function oauthError(c: Context<AppEnv>, error: string, description?: string, status: 400 | 500 = 400): Response {
  if (description === undefined) return c.json({ error }, status);
  return c.json({ error, error_description: description }, status);
}

function withParams(base: string, params: Record<string, string>): string {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

function parseScopeParam(value: string | undefined): McpScope[] | null {
  if (value === undefined) return ["read"];
  const scopes: McpScope[] = [];
  for (const part of value.trim().split(/\s+/)) {
    if (!isMcpScope(part)) return null;
    if (!scopes.includes(part)) scopes.push(part);
  }
  return scopes.length === 0 ? ["read"] : scopes;
}

type AuthorizeRequest = {
  client: OAuthClient;
  redirectUri: string;
  codeChallenge: string;
  scopes: McpScope[];
  state: string | undefined;
};

type AuthorizeOutcome = { ok: true; request: AuthorizeRequest } | { ok: false; error: string };

async function parseAuthorizeRequest(
  body: Record<string, unknown>,
  repo: OAuthRepository,
): Promise<AuthorizeOutcome> {
  if (stringField(body, "response_type") !== "code") return { ok: false, error: "unsupported_response_type" };

  const clientId = stringField(body, "client_id");
  if (clientId === undefined) return { ok: false, error: "invalid_request" };
  const found = await repo.findClient(clientId);
  if (!found.ok || found.value === undefined) return { ok: false, error: "invalid_client" };

  const redirectUri = stringField(body, "redirect_uri");
  if (redirectUri === undefined || !found.value.redirect_uris.includes(redirectUri)) {
    return { ok: false, error: "invalid_request" };
  }

  const codeChallenge = stringField(body, "code_challenge");
  if (codeChallenge === undefined || stringField(body, "code_challenge_method") !== "S256") {
    return { ok: false, error: "invalid_request" };
  }

  const scopes = parseScopeParam(stringField(body, "scope"));
  if (scopes === null) return { ok: false, error: "invalid_scope" };

  return {
    ok: true,
    request: { client: found.value, redirectUri, codeChallenge, scopes, state: stringField(body, "state") },
  };
}

function consentParams(request: AuthorizeRequest): Record<string, string> {
  const params: Record<string, string> = {
    response_type: "code",
    client_id: request.client.client_id,
    redirect_uri: request.redirectUri,
    code_challenge: request.codeChallenge,
    code_challenge_method: "S256",
    scope: request.scopes.join(" "),
  };
  if (request.state !== undefined) params["state"] = request.state;
  return params;
}

function stateParam(state: string | undefined): Record<string, string> {
  return state === undefined ? {} : { state };
}

function isAllowedRedirectUri(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.hash !== "") return false;
  if (url.protocol === "https:") return true;
  if (url.protocol !== "http:") return false;
  return url.hostname === "127.0.0.1" || url.hostname === "localhost";
}

function parseRedirectUris(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const uris: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !isAllowedRedirectUri(item)) return null;
    if (!uris.includes(item)) uris.push(item);
  }
  return uris;
}

type TokenPayload = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
};

type TokenOutcome = { ok: true; payload: TokenPayload } | { ok: false; error: string };

async function issueTokens(
  repo: OAuthRepository,
  clientId: string,
  scopes: McpScope[],
): Promise<TokenPayload | null> {
  const now = Date.now();
  const createdAt = new Date(now).toISOString();
  const accessToken = randomToken(ACCESS_TOKEN_PREFIX);
  const refreshToken = randomToken(REFRESH_TOKEN_PREFIX);

  const access = await repo.insertToken({
    token_hash: await sha256Hex(accessToken),
    kind: "access",
    client_id: clientId,
    scopes,
    expires_at: new Date(now + ACCESS_TOKEN_TTL_SECONDS * 1000).toISOString(),
    created_at: createdAt,
    revoked_at: null,
  });
  if (!access.ok) return null;

  const refresh = await repo.insertToken({
    token_hash: await sha256Hex(refreshToken),
    kind: "refresh",
    client_id: clientId,
    scopes,
    expires_at: new Date(now + REFRESH_TOKEN_TTL_MS).toISOString(),
    created_at: createdAt,
    revoked_at: null,
  });
  if (!refresh.ok) return null;

  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: refreshToken,
    scope: scopes.join(" "),
  };
}

/** Issues access and refresh tokens, mapping a failure to the OAuth invalid_grant error. */
async function grantTokens(repo: OAuthRepository, clientId: string, scopes: readonly McpScope[]): Promise<TokenOutcome> {
  const payload = await issueTokens(repo, clientId, scopes.filter(isMcpScope));
  return payload === null ? { ok: false, error: "invalid_grant" } : { ok: true, payload };
}

async function authorizationCodeGrant(
  repo: OAuthRepository,
  body: Record<string, unknown>,
): Promise<TokenOutcome> {
  const code = stringField(body, "code");
  const clientId = stringField(body, "client_id");
  const redirectUri = stringField(body, "redirect_uri");
  const verifier = stringField(body, "code_verifier");
  if (code === undefined || clientId === undefined || redirectUri === undefined || verifier === undefined) {
    return { ok: false, error: "invalid_request" };
  }

  const client = await repo.findClient(clientId);
  if (!client.ok || client.value === undefined) return { ok: false, error: "invalid_client" };

  const stored = await repo.consumeCode(await sha256Hex(code));
  if (!stored.ok || stored.value === undefined) return { ok: false, error: "invalid_grant" };
  const record = stored.value;
  if (record.client_id !== clientId || record.redirect_uri !== redirectUri) {
    return { ok: false, error: "invalid_grant" };
  }
  if (Date.parse(record.expires_at) <= Date.now()) return { ok: false, error: "invalid_grant" };

  const challenge = await sha256Base64Url(verifier);
  if (!timingSafeEqual(challenge, record.code_challenge)) return { ok: false, error: "invalid_grant" };

  return grantTokens(repo, clientId, record.scopes);
}

async function refreshTokenGrant(repo: OAuthRepository, body: Record<string, unknown>): Promise<TokenOutcome> {
  const refreshToken = stringField(body, "refresh_token");
  const clientId = stringField(body, "client_id");
  if (refreshToken === undefined || clientId === undefined) return { ok: false, error: "invalid_request" };

  const client = await repo.findClient(clientId);
  if (!client.ok || client.value === undefined) return { ok: false, error: "invalid_client" };

  const hash = await sha256Hex(refreshToken);
  const stored = await repo.findTokenByHash(hash);
  if (!stored.ok || stored.value === undefined) return { ok: false, error: "invalid_grant" };
  const record = stored.value;
  if (record.kind !== "refresh" || record.client_id !== clientId) return { ok: false, error: "invalid_grant" };
  if (record.revoked_at !== null || Date.parse(record.expires_at) <= Date.now()) {
    return { ok: false, error: "invalid_grant" };
  }

  const revoked = await repo.revokeToken(hash);
  if (!revoked.ok) return { ok: false, error: "invalid_grant" };

  return grantTokens(repo, clientId, record.scopes);
}

function runTokenGrant(
  repo: OAuthRepository,
  grantType: string | undefined,
  body: Record<string, unknown>,
): Promise<TokenOutcome> {
  if (grantType === "authorization_code") return authorizationCodeGrant(repo, body);
  if (grantType === "refresh_token") return refreshTokenGrant(repo, body);
  if (grantType === undefined) return Promise.resolve({ ok: false, error: "invalid_request" });
  return Promise.resolve({ ok: false, error: "unsupported_grant_type" });
}

function registerMetadataRoutes(app: Hono<AppEnv>): void {
  app.get(PROTECTED_RESOURCE_PATH, (c) => {
    const origin = originOf(c);
    return c.json({
      resource: origin,
      authorization_servers: [origin],
      scopes_supported: ["read", "write"],
      bearer_methods_supported: ["header"],
    });
  });

  app.get("/.well-known/oauth-authorization-server", (c) => {
    const origin = originOf(c);
    return c.json({
      issuer: origin,
      authorization_endpoint: `${origin}/oauth/authorize`,
      token_endpoint: `${origin}/oauth/token`,
      registration_endpoint: `${origin}/oauth/register`,
      revocation_endpoint: `${origin}/oauth/revoke`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      scopes_supported: ["read", "write"],
    });
  });
}

function registerClientRoutes(app: Hono<AppEnv>): void {
  app.post("/oauth/register", async (c) => {
    const body = await readRequestBody(c);
    const name = stringField(body, "client_name");
    const redirectUris = parseRedirectUris(body["redirect_uris"]);
    if (name === undefined) return oauthError(c, "invalid_client_metadata", "client_name is required");
    if (redirectUris === null) {
      return oauthError(c, "invalid_redirect_uri", "redirect_uris must be https or loopback http");
    }

    const client: OAuthClient = {
      client_id: crypto.randomUUID(),
      client_name: name,
      redirect_uris: redirectUris,
      created_at: new Date().toISOString(),
    };
    const inserted = await oauthRepository(c.env).insertClient(client);
    if (!inserted.ok) return oauthError(c, "invalid_client_metadata", "the client could not be registered");

    return c.json(
      {
        client_id: client.client_id,
        client_name: client.client_name,
        redirect_uris: client.redirect_uris,
        token_endpoint_auth_method: "none",
      },
      201,
    );
  });
}

function registerAuthorizeRoutes(app: Hono<AppEnv>): void {
  app.get("/oauth/authorize", async (c) => {
    const parsed = await parseAuthorizeRequest(c.req.query(), oauthRepository(c.env));
    if (!parsed.ok) return oauthError(c, parsed.error);
    const request = parsed.request;
    return c.html(
      ConsentPage({
        clientName: request.client.client_name,
        scopes: request.scopes,
        params: consentParams(request),
      }),
    );
  });

  app.post("/oauth/authorize", async (c) => {
    const body = await readRequestBody(c);
    const parsed = await parseAuthorizeRequest(body, oauthRepository(c.env));
    if (!parsed.ok) return oauthError(c, parsed.error);
    const request = parsed.request;

    if (stringField(body, "decision") !== "allow") {
      return c.redirect(withParams(request.redirectUri, { error: "access_denied", ...stateParam(request.state) }));
    }

    const code = randomToken(CODE_PREFIX);
    const now = Date.now();
    const inserted = await oauthRepository(c.env).insertCode({
      code_hash: await sha256Hex(code),
      client_id: request.client.client_id,
      redirect_uri: request.redirectUri,
      scopes: request.scopes,
      code_challenge: request.codeChallenge,
      expires_at: new Date(now + CODE_TTL_MS).toISOString(),
      created_at: new Date(now).toISOString(),
    });
    if (!inserted.ok) return c.json({ error: "server_error" }, 500);

    return c.redirect(withParams(request.redirectUri, { code, ...stateParam(request.state) }));
  });
}

function registerTokenRoutes(app: Hono<AppEnv>): void {
  app.post("/oauth/token", async (c) => {
    const body = await readRequestBody(c);
    const outcome = await runTokenGrant(oauthRepository(c.env), stringField(body, "grant_type"), body);
    return outcome.ok ? c.json(outcome.payload) : oauthError(c, outcome.error);
  });

  app.post("/oauth/revoke", async (c) => {
    const body = await readRequestBody(c);
    const token = stringField(body, "token");
    if (token !== undefined) await oauthRepository(c.env).revokeToken(await sha256Hex(token));
    return c.body(null, 200);
  });
}

async function connectionView(repo: OAuthRepository, client: OAuthClient): Promise<ConnectionView> {
  const listed = await repo.listTokens(client.client_id);
  const tokens = listed.ok ? listed.value : [];
  return {
    clientId: client.client_id,
    clientName: client.client_name,
    redirectUris: client.redirect_uris,
    activeTokens: tokens.filter(isActiveToken).length,
    createdAt: client.created_at,
  };
}

function registerConnectionRoutes(app: Hono<AppEnv>): void {
  app.get("/connections", async (c) => {
    const repo = oauthRepository(c.env);
    const listed = await repo.listClients();
    const clients = listed.ok ? listed.value : [];
    const connections = await Promise.all(clients.map((client) => connectionView(repo, client)));
    return c.html(ConnectionsPage({ connections }));
  });

  app.post("/connections/revoke", async (c) => {
    const body = await readRequestBody(c);
    const clientId = stringField(body, "client_id");
    if (clientId !== undefined) await oauthRepository(c.env).revokeByClient(clientId);
    return c.redirect("/connections");
  });
}

/** OAuth のエンドポイント一式を登録する（metadata / register / authorize / token / revoke / connections）。 */
export function registerOAuthRoutes(app: Hono<AppEnv>): void {
  registerMetadataRoutes(app);
  registerClientRoutes(app);
  registerAuthorizeRoutes(app);
  registerTokenRoutes(app);
  registerConnectionRoutes(app);
}
