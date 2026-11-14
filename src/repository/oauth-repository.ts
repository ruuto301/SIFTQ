import type { Result } from "../task";

/** Scopes an MCP client can request. `write` includes deleting tasks. */
export const OAUTH_SCOPES = ["read", "write"] as const;
export type OAuthScope = (typeof OAUTH_SCOPES)[number];

export function isOAuthScope(value: unknown): value is OAuthScope {
  return typeof value === "string" && OAUTH_SCOPES.some((scope) => scope === value);
}

export type OAuthClient = {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
  created_at: string;
};

/** An authorization code is only ever stored as its SHA-256 hash. */
export type OAuthCode = {
  code_hash: string;
  client_id: string;
  redirect_uri: string;
  scopes: OAuthScope[];
  code_challenge: string;
  expires_at: string;
  created_at: string;
};

export type OAuthTokenKind = "access" | "refresh";

/** An issued token is only ever stored as its SHA-256 hash. */
export type OAuthToken = {
  token_hash: string;
  kind: OAuthTokenKind;
  client_id: string;
  scopes: OAuthScope[];
  expires_at: string;
  created_at: string;
  revoked_at: string | null;
};

export type McpAuditEntry = {
  id: string;
  client_id: string;
  tool: string;
  target: string | null;
  status: string;
  created_at: string;
};

export type OAuthRepositoryError = { code: "NOT_FOUND" | "CONFLICT" | "INVALID_INPUT" };

export interface OAuthRepository {
  insertClient(client: OAuthClient): Promise<Result<OAuthClient, OAuthRepositoryError>>;
  findClient(client_id: string): Promise<Result<OAuthClient | undefined, OAuthRepositoryError>>;
  listClients(): Promise<Result<OAuthClient[], OAuthRepositoryError>>;
  insertCode(code: OAuthCode): Promise<Result<OAuthCode, OAuthRepositoryError>>;
  /** Returns the code once and removes it, so a code can never be replayed. */
  consumeCode(code_hash: string): Promise<Result<OAuthCode | undefined, OAuthRepositoryError>>;
  insertToken(token: OAuthToken): Promise<Result<OAuthToken, OAuthRepositoryError>>;
  findTokenByHash(token_hash: string): Promise<Result<OAuthToken | undefined, OAuthRepositoryError>>;
  listTokens(client_id: string): Promise<Result<OAuthToken[], OAuthRepositoryError>>;
  revokeToken(token_hash: string): Promise<Result<null, OAuthRepositoryError>>;
  revokeByClient(client_id: string): Promise<Result<null, OAuthRepositoryError>>;
  insertAudit(entry: McpAuditEntry): Promise<Result<McpAuditEntry, OAuthRepositoryError>>;
}
