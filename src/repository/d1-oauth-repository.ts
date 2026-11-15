import type { D1Database, D1Result } from "@cloudflare/workers-types";
import { err, isRecord, ok } from "../task";
import type { Result } from "../task";
import { isOAuthScope } from "./oauth-repository";
import type {
  McpAuditEntry,
  OAuthClient,
  OAuthCode,
  OAuthRepository,
  OAuthRepositoryError,
  OAuthScope,
  OAuthToken,
  OAuthTokenKind,
} from "./oauth-repository";

const CLIENT_COLUMNS = "client_id, client_name, redirect_uris, created_at";
const CODE_COLUMNS = "code_hash, client_id, redirect_uri, scopes, code_challenge, expires_at, created_at";
const TOKEN_COLUMNS = "token_hash, kind, client_id, scopes, expires_at, created_at, revoked_at";

function changes(result: D1Result): number {
  return result.meta?.changes ?? 0;
}

function parseScopes(value: unknown): OAuthScope[] | undefined {
  if (typeof value !== "string") return undefined;
  if (value === "") return [];
  const scopes: OAuthScope[] = [];
  for (const part of value.split(" ")) {
    if (!isOAuthScope(part)) return undefined;
    scopes.push(part);
  }
  return scopes;
}

function parseRedirectUris(value: unknown): string[] | undefined {
  if (typeof value !== "string") return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return undefined;
  }
  if (!Array.isArray(parsed)) return undefined;
  const uris: string[] = [];
  for (const uri of parsed) {
    if (typeof uri !== "string") return undefined;
    uris.push(uri);
  }
  return uris;
}

function toClient(value: unknown): OAuthClient | undefined {
  if (!isRecord(value)) return undefined;
  const { client_id, client_name, redirect_uris, created_at } = value;
  const uris = parseRedirectUris(redirect_uris);
  if (
    typeof client_id !== "string" ||
    typeof client_name !== "string" ||
    uris === undefined ||
    typeof created_at !== "string"
  ) {
    return undefined;
  }
  return { client_id, client_name, redirect_uris: uris, created_at };
}

function toCode(value: unknown): OAuthCode | undefined {
  if (!isRecord(value)) return undefined;
  const { code_hash, client_id, redirect_uri, scopes, code_challenge, expires_at, created_at } = value;
  const parsedScopes = parseScopes(scopes);
  if (
    typeof code_hash !== "string" ||
    typeof client_id !== "string" ||
    typeof redirect_uri !== "string" ||
    parsedScopes === undefined ||
    typeof code_challenge !== "string" ||
    typeof expires_at !== "string" ||
    typeof created_at !== "string"
  ) {
    return undefined;
  }
  return {
    code_hash,
    client_id,
    redirect_uri,
    scopes: parsedScopes,
    code_challenge,
    expires_at,
    created_at,
  };
}

function toTokenKind(value: unknown): OAuthTokenKind | undefined {
  return value === "access" || value === "refresh" ? value : undefined;
}

function toToken(value: unknown): OAuthToken | undefined {
  if (!isRecord(value)) return undefined;
  const { token_hash, kind, client_id, scopes, expires_at, created_at, revoked_at } = value;
  const parsedScopes = parseScopes(scopes);
  const parsedKind = toTokenKind(kind);
  if (
    typeof token_hash !== "string" ||
    parsedKind === undefined ||
    typeof client_id !== "string" ||
    parsedScopes === undefined ||
    typeof expires_at !== "string" ||
    typeof created_at !== "string" ||
    (revoked_at !== null && typeof revoked_at !== "string")
  ) {
    return undefined;
  }
  return {
    token_hash,
    kind: parsedKind,
    client_id,
    scopes: parsedScopes,
    expires_at,
    created_at,
    revoked_at,
  };
}

async function insertClient(
  db: D1Database,
  client: OAuthClient,
): Promise<Result<OAuthClient, OAuthRepositoryError>> {
  await db
    .prepare("INSERT INTO oauth_clients (client_id, client_name, redirect_uris, created_at) VALUES (?, ?, ?, ?)")
    .bind(client.client_id, client.client_name, JSON.stringify(client.redirect_uris), client.created_at)
    .run();
  return ok(client);
}

async function findClient(
  db: D1Database,
  client_id: string,
): Promise<Result<OAuthClient | undefined, OAuthRepositoryError>> {
  const row = await db
    .prepare(`SELECT ${CLIENT_COLUMNS} FROM oauth_clients WHERE client_id = ?`)
    .bind(client_id)
    .first<Record<string, unknown>>();
  return ok(row === null ? undefined : toClient(row));
}

async function listClients(db: D1Database): Promise<Result<OAuthClient[], OAuthRepositoryError>> {
  const result = await db
    .prepare(`SELECT ${CLIENT_COLUMNS} FROM oauth_clients ORDER BY created_at ASC`)
    .all<Record<string, unknown>>();
  return ok(result.results.map(toClient).filter((client): client is OAuthClient => client !== undefined));
}

async function insertCode(db: D1Database, code: OAuthCode): Promise<Result<OAuthCode, OAuthRepositoryError>> {
  await db
    .prepare(
      "INSERT INTO oauth_codes (code_hash, client_id, redirect_uri, scopes, code_challenge, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      code.code_hash,
      code.client_id,
      code.redirect_uri,
      code.scopes.join(" "),
      code.code_challenge,
      code.expires_at,
      code.created_at,
    )
    .run();
  return ok(code);
}

async function consumeCode(
  db: D1Database,
  code_hash: string,
): Promise<Result<OAuthCode | undefined, OAuthRepositoryError>> {
  const row = await db
    .prepare(`SELECT ${CODE_COLUMNS} FROM oauth_codes WHERE code_hash = ?`)
    .bind(code_hash)
    .first<Record<string, unknown>>();
  const code = row === null ? undefined : toCode(row);
  if (code === undefined) return ok(undefined);
  const result = await db.prepare("DELETE FROM oauth_codes WHERE code_hash = ?").bind(code_hash).run();
  return ok(changes(result) === 0 ? undefined : code);
}

async function insertToken(db: D1Database, token: OAuthToken): Promise<Result<OAuthToken, OAuthRepositoryError>> {
  await db
    .prepare(
      "INSERT INTO oauth_tokens (token_hash, kind, client_id, scopes, expires_at, created_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      token.token_hash,
      token.kind,
      token.client_id,
      token.scopes.join(" "),
      token.expires_at,
      token.created_at,
      token.revoked_at,
    )
    .run();
  return ok(token);
}

async function findTokenByHash(
  db: D1Database,
  token_hash: string,
): Promise<Result<OAuthToken | undefined, OAuthRepositoryError>> {
  const row = await db
    .prepare(`SELECT ${TOKEN_COLUMNS} FROM oauth_tokens WHERE token_hash = ?`)
    .bind(token_hash)
    .first<Record<string, unknown>>();
  return ok(row === null ? undefined : toToken(row));
}

async function listTokens(
  db: D1Database,
  client_id: string,
): Promise<Result<OAuthToken[], OAuthRepositoryError>> {
  const result = await db
    .prepare(`SELECT ${TOKEN_COLUMNS} FROM oauth_tokens WHERE client_id = ? ORDER BY created_at DESC`)
    .bind(client_id)
    .all<Record<string, unknown>>();
  return ok(result.results.map(toToken).filter((token): token is OAuthToken => token !== undefined));
}

async function revokeToken(
  db: D1Database,
  token_hash: string,
): Promise<Result<null, OAuthRepositoryError>> {
  const result = await db
    .prepare("UPDATE oauth_tokens SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL")
    .bind(new Date().toISOString(), token_hash)
    .run();
  return changes(result) === 0 ? err({ code: "NOT_FOUND" }) : ok(null);
}

async function revokeByClient(
  db: D1Database,
  client_id: string,
): Promise<Result<null, OAuthRepositoryError>> {
  await db
    .prepare("UPDATE oauth_tokens SET revoked_at = ? WHERE client_id = ? AND revoked_at IS NULL")
    .bind(new Date().toISOString(), client_id)
    .run();
  return ok(null);
}

async function insertAudit(
  db: D1Database,
  entry: McpAuditEntry,
): Promise<Result<McpAuditEntry, OAuthRepositoryError>> {
  await db
    .prepare("INSERT INTO mcp_audit (id, client_id, tool, target, status, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(entry.id, entry.client_id, entry.tool, entry.target, entry.status, entry.created_at)
    .run();
  return ok(entry);
}

export function createD1OAuthRepository(db: D1Database): OAuthRepository {
  return {
    insertClient: (client) => insertClient(db, client),
    findClient: (client_id) => findClient(db, client_id),
    listClients: () => listClients(db),
    insertCode: (code) => insertCode(db, code),
    consumeCode: (code_hash) => consumeCode(db, code_hash),
    insertToken: (token) => insertToken(db, token),
    findTokenByHash: (token_hash) => findTokenByHash(db, token_hash),
    listTokens: (client_id) => listTokens(db, client_id),
    revokeToken: (token_hash) => revokeToken(db, token_hash),
    revokeByClient: (client_id) => revokeByClient(db, client_id),
    insertAudit: (entry) => insertAudit(db, entry),
  };
}
