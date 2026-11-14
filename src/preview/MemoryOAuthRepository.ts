import { err, ok } from "../task";
import type { Result } from "../task";
import type {
  McpAuditEntry,
  OAuthClient,
  OAuthCode,
  OAuthRepository,
  OAuthRepositoryError,
  OAuthToken,
} from "../repository/oauth-repository";

export type MemoryOAuthSeed = {
  clients?: readonly OAuthClient[];
  codes?: readonly OAuthCode[];
  tokens?: readonly OAuthToken[];
  audits?: readonly McpAuditEntry[];
};

type ClientStore = Map<string, OAuthClient>;
type CodeStore = Map<string, OAuthCode>;
type TokenStore = Map<string, OAuthToken>;
type AuditStore = McpAuditEntry[];

function insertClient(clients: ClientStore, client: OAuthClient): Result<OAuthClient, OAuthRepositoryError> {
  if (clients.has(client.client_id)) return err({ code: "CONFLICT" });
  clients.set(client.client_id, client);
  return ok(client);
}

function findClient(clients: ClientStore, client_id: string): Result<OAuthClient | undefined, OAuthRepositoryError> {
  return ok(clients.get(client_id));
}

function listClients(clients: ClientStore): Result<OAuthClient[], OAuthRepositoryError> {
  return ok([...clients.values()]);
}

function insertCode(codes: CodeStore, code: OAuthCode): Result<OAuthCode, OAuthRepositoryError> {
  if (codes.has(code.code_hash)) return err({ code: "CONFLICT" });
  codes.set(code.code_hash, code);
  return ok(code);
}

function consumeCode(codes: CodeStore, code_hash: string): Result<OAuthCode | undefined, OAuthRepositoryError> {
  const code = codes.get(code_hash);
  codes.delete(code_hash);
  return ok(code);
}

function insertToken(tokens: TokenStore, token: OAuthToken): Result<OAuthToken, OAuthRepositoryError> {
  if (tokens.has(token.token_hash)) return err({ code: "CONFLICT" });
  tokens.set(token.token_hash, token);
  return ok(token);
}

function findTokenByHash(
  tokens: TokenStore,
  token_hash: string,
): Result<OAuthToken | undefined, OAuthRepositoryError> {
  return ok(tokens.get(token_hash));
}

function listTokens(tokens: TokenStore, client_id: string): Result<OAuthToken[], OAuthRepositoryError> {
  return ok([...tokens.values()].filter((token) => token.client_id === client_id));
}

function revokeToken(tokens: TokenStore, token_hash: string): Result<null, OAuthRepositoryError> {
  const token = tokens.get(token_hash);
  if (token === undefined || token.revoked_at !== null) return err({ code: "NOT_FOUND" });
  tokens.set(token_hash, { ...token, revoked_at: new Date().toISOString() });
  return ok(null);
}

function revokeByClient(tokens: TokenStore, client_id: string): Result<null, OAuthRepositoryError> {
  const revokedAt = new Date().toISOString();
  for (const [hash, token] of tokens) {
    if (token.client_id === client_id && token.revoked_at === null) {
      tokens.set(hash, { ...token, revoked_at: revokedAt });
    }
  }
  return ok(null);
}

function insertAudit(audits: AuditStore, entry: McpAuditEntry): Result<McpAuditEntry, OAuthRepositoryError> {
  audits.push(entry);
  return ok(entry);
}

/** In-memory OAuth store for tests and PREVIEW mode. */
export function createMemoryOAuthRepository(seed: MemoryOAuthSeed = {}): OAuthRepository {
  const clients: ClientStore = new Map((seed.clients ?? []).map((client) => [client.client_id, client]));
  const codes: CodeStore = new Map((seed.codes ?? []).map((code) => [code.code_hash, code]));
  const tokens: TokenStore = new Map((seed.tokens ?? []).map((token) => [token.token_hash, token]));
  const audits: AuditStore = [...(seed.audits ?? [])];

  return {
    insertClient: async (client) => insertClient(clients, client),
    findClient: async (client_id) => findClient(clients, client_id),
    listClients: async () => listClients(clients),
    insertCode: async (code) => insertCode(codes, code),
    consumeCode: async (code_hash) => consumeCode(codes, code_hash),
    insertToken: async (token) => insertToken(tokens, token),
    findTokenByHash: async (token_hash) => findTokenByHash(tokens, token_hash),
    listTokens: async (client_id) => listTokens(tokens, client_id),
    revokeToken: async (token_hash) => revokeToken(tokens, token_hash),
    revokeByClient: async (client_id) => revokeByClient(tokens, client_id),
    insertAudit: async (entry) => insertAudit(audits, entry),
  };
}
