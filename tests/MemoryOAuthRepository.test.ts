import { describe, expect, it } from "vite-plus/test";
import { createMemoryOAuthRepository } from "../src/preview/MemoryOAuthRepository";
import type { OAuthClient, OAuthToken } from "../src/repository/oauth-repository";

function client(overrides: Partial<OAuthClient> = {}): OAuthClient {
  return {
    client_id: "client-1",
    client_name: "Test Client",
    redirect_uris: ["https://client.example/callback"],
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function token(overrides: Partial<OAuthToken> = {}): OAuthToken {
  return {
    token_hash: "hash-1",
    kind: "access",
    client_id: "client-1",
    scopes: ["read"],
    expires_at: "2026-01-02T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    revoked_at: null,
    ...overrides,
  };
}

describe("MemoryOAuthRepository", () => {
  it("stores and finds clients", async () => {
    const repository = createMemoryOAuthRepository();
    await repository.insertClient(client());

    expect(await repository.findClient("client-1")).toEqual({ ok: true, value: client() });
    expect(await repository.listClients()).toEqual({ ok: true, value: [client()] });
    const duplicated = await repository.insertClient(client());
    expect(duplicated).toEqual({ ok: false, error: { code: "CONFLICT" } });
  });

  it("consumes an authorization code once", async () => {
    const repository = createMemoryOAuthRepository();
    const code = {
      code_hash: "code-hash",
      client_id: "client-1",
      redirect_uri: "https://client.example/callback",
      scopes: ["read"] as const,
      code_challenge: "challenge",
      expires_at: "2026-01-02T00:00:00.000Z",
      created_at: "2026-01-01T00:00:00.000Z",
    };
    await repository.insertCode({ ...code, scopes: [...code.scopes] });

    const consumed = await repository.consumeCode("code-hash");
    expect(consumed.ok).toBe(true);
    expect(await repository.consumeCode("code-hash")).toEqual({ ok: true, value: undefined });
  });

  it("revokes tokens by hash and by client", async () => {
    const repository = createMemoryOAuthRepository();
    await repository.insertToken(token());
    await repository.insertToken(token({ token_hash: "hash-2", kind: "refresh" }));

    expect(await repository.revokeToken("hash-1")).toEqual({ ok: true, value: null });
    const listed = await repository.listTokens("client-1");
    expect(listed.ok && listed.value.map((entry) => entry.revoked_at !== null)).toEqual([true, false]);
    expect(await repository.revokeByClient("client-1")).toEqual({ ok: true, value: null });
    const after = await repository.listTokens("client-1");
    expect(after.ok && after.value.every((entry) => entry.revoked_at !== null)).toBe(true);
  });
});
