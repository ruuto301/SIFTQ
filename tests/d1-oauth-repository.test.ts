import { describe, expect, it } from "vite-plus/test";
import type { D1Database, D1PreparedStatement, D1Result } from "@cloudflare/workers-types";
import { createD1OAuthRepository } from "../src/repository/d1-oauth-repository";
import type { OAuthClient, OAuthCode, OAuthToken } from "../src/repository/oauth-repository";

type Execution = { query: string; values: readonly unknown[] };

function isRow<T>(value: unknown): value is T {
  return typeof value === "object" && value !== null;
}

function isRowArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}

function successResult<T>(results: T[], changes = 0): D1Result<T> {
  return {
    success: true,
    results,
    meta: {
      duration: 0,
      size_after: 0,
      rows_read: 0,
      rows_written: 0,
      last_row_id: 0,
      changed_db: false,
      changes,
    },
  };
}

class RecordingPreparedStatement implements D1PreparedStatement {
  private values: readonly unknown[] = [];

  constructor(
    private readonly recorder: RecordingD1Database,
    private readonly query: string,
  ) {}

  bind(...values: unknown[]): D1PreparedStatement {
    this.values = values;
    return this;
  }

  first<T = Record<string, unknown>>(): Promise<T | null> {
    this.recorder.record(this.query, this.values);
    const row = this.recorder.firstRows.shift();
    return Promise.resolve(isRow<T>(row) ? row : null);
  }

  run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    this.recorder.record(this.query, this.values);
    return Promise.resolve(successResult<T>([], this.recorder.runChanges));
  }

  all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    this.recorder.record(this.query, this.values);
    const rows = this.recorder.allRows.shift();
    return Promise.resolve(successResult<T>(isRowArray<T>(rows) ? rows : []));
  }

  raw<T = unknown[]>(_options: { columnNames: true }): Promise<[string[], ...T[]]>;
  raw<T = unknown[]>(_options?: { columnNames?: false }): Promise<T[]>;
  raw<T = unknown[]>(_options?: { columnNames?: boolean }): Promise<T[]> {
    return Promise.reject(new Error("raw is not implemented in this test double"));
  }
}

class RecordingD1Database implements D1Database {
  readonly executions: Execution[] = [];
  readonly firstRows: unknown[] = [];
  readonly allRows: unknown[] = [];
  runChanges = 1;

  prepare(query: string): D1PreparedStatement {
    return new RecordingPreparedStatement(this, query);
  }

  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    return Promise.all(statements.map((statement) => statement.run<T>()));
  }

  exec(): Promise<never> {
    return Promise.reject(new Error("exec is not implemented in this test double"));
  }

  withSession(): never {
    throw new Error("withSession is not implemented in this test double");
  }

  dump(): Promise<never> {
    return Promise.reject(new Error("dump is not implemented in this test double"));
  }

  record(query: string, values: readonly unknown[]): void {
    this.executions.push({ query, values: [...values] });
  }
}

const CREATED_AT = "2026-01-01T00:00:00.000Z";

function clientRow(): Record<string, unknown> {
  return {
    client_id: "client-1",
    client_name: "Test Client",
    redirect_uris: '["https://client.example/callback"]',
    created_at: CREATED_AT,
  };
}

function codeRow(): Record<string, unknown> {
  return {
    code_hash: "code-hash",
    client_id: "client-1",
    redirect_uri: "https://client.example/callback",
    scopes: "read write",
    code_challenge: "challenge",
    expires_at: CREATED_AT,
    created_at: CREATED_AT,
  };
}

function tokenRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    token_hash: "token-hash",
    kind: "access",
    client_id: "client-1",
    scopes: "read",
    expires_at: CREATED_AT,
    created_at: CREATED_AT,
    revoked_at: null,
    ...overrides,
  };
}

describe("D1 OAuth repository reads", () => {
  it("parses a client row and its JSON redirect_uris", async () => {
    const database = new RecordingD1Database();
    database.firstRows.push(clientRow());

    const found = await createD1OAuthRepository(database).findClient("client-1");

    expect(found).toEqual({
      ok: true,
      value: {
        client_id: "client-1",
        client_name: "Test Client",
        redirect_uris: ["https://client.example/callback"],
        created_at: CREATED_AT,
      },
    });
    expect(database.executions[0]?.values).toEqual(["client-1"]);
  });

  it("returns undefined for a row that is missing a required column", async () => {
    const database = new RecordingD1Database();
    database.firstRows.push({ client_id: "client-1" });

    const found = await createD1OAuthRepository(database).findClient("client-1");

    expect(found).toEqual({ ok: true, value: undefined });
  });

  it("parses token scopes, kind and revocation state", async () => {
    const database = new RecordingD1Database();
    database.firstRows.push(tokenRow({ kind: "refresh", scopes: "read write", revoked_at: CREATED_AT }));

    const found = await createD1OAuthRepository(database).findTokenByHash("token-hash");

    expect(found).toEqual({
      ok: true,
      value: {
        token_hash: "token-hash",
        kind: "refresh",
        client_id: "client-1",
        scopes: ["read", "write"],
        expires_at: CREATED_AT,
        created_at: CREATED_AT,
        revoked_at: CREATED_AT,
      },
    });
  });

  it("drops an unparsable row from a token list", async () => {
    const database = new RecordingD1Database();
    database.allRows.push([tokenRow(), { token_hash: "broken", scopes: "admin" }]);

    const listed = await createD1OAuthRepository(database).listTokens("client-1");

    expect(listed).toEqual({
      ok: true,
      value: [
        {
          token_hash: "token-hash",
          kind: "access",
          client_id: "client-1",
          scopes: ["read"],
          expires_at: CREATED_AT,
          created_at: CREATED_AT,
          revoked_at: null,
        },
      ],
    });
    expect(database.executions[0]?.values).toEqual(["client-1"]);
  });
});

describe("D1 OAuth repository writes", () => {
  it("inserts a client with its redirect_uris serialized as JSON", async () => {
    const database = new RecordingD1Database();
    const client: OAuthClient = {
      client_id: "client-1",
      client_name: "Test Client",
      redirect_uris: ["https://client.example/callback"],
      created_at: CREATED_AT,
    };

    expect(await createD1OAuthRepository(database).insertClient(client)).toEqual({ ok: true, value: client });
    expect(database.executions[0]?.query).toContain("INSERT INTO oauth_clients");
    expect(database.executions[0]?.values).toEqual([
      "client-1",
      "Test Client",
      '["https://client.example/callback"]',
      CREATED_AT,
    ]);
  });

  it("inserts a token with scopes joined and revoked_at null", async () => {
    const database = new RecordingD1Database();
    const token: OAuthToken = {
      token_hash: "token-hash",
      kind: "refresh",
      client_id: "client-1",
      scopes: ["read", "write"],
      expires_at: CREATED_AT,
      created_at: CREATED_AT,
      revoked_at: null,
    };

    expect(await createD1OAuthRepository(database).insertToken(token)).toEqual({ ok: true, value: token });
    expect(database.executions[0]?.query).toContain("INSERT INTO oauth_tokens");
    expect(database.executions[0]?.values).toEqual([
      "token-hash",
      "refresh",
      "client-1",
      "read write",
      CREATED_AT,
      CREATED_AT,
      null,
    ]);
  });

});

describe("D1 OAuth code consumption", () => {
  it("consumes a code once and then reports it as gone", async () => {
    const database = new RecordingD1Database();
    const repository = createD1OAuthRepository(database);
    const code: OAuthCode = {
      code_hash: "code-hash",
      client_id: "client-1",
      redirect_uri: "https://client.example/callback",
      scopes: ["read", "write"],
      code_challenge: "challenge",
      expires_at: CREATED_AT,
      created_at: CREATED_AT,
    };

    database.firstRows.push(codeRow());
    expect(await repository.consumeCode("code-hash")).toEqual({ ok: true, value: code });
    expect(database.executions[1]?.query).toContain("DELETE FROM oauth_codes");

    database.firstRows.push(codeRow());
    database.runChanges = 0;
    expect(await repository.consumeCode("code-hash")).toEqual({ ok: true, value: undefined });
  });
});

describe("D1 OAuth repository revocation and audit", () => {
  it("reports NOT_FOUND when a token was already revoked", async () => {
    const database = new RecordingD1Database();
    database.runChanges = 0;

    const revoked = await createD1OAuthRepository(database).revokeToken("token-hash");

    expect(revoked).toEqual({ ok: false, error: { code: "NOT_FOUND" } });
    expect(database.executions[0]?.query).toContain("revoked_at IS NULL");
    expect(database.executions[0]?.values[1]).toBe("token-hash");
  });

  it("revokes every token of a client", async () => {
    const database = new RecordingD1Database();

    const revoked = await createD1OAuthRepository(database).revokeByClient("client-1");

    expect(revoked).toEqual({ ok: true, value: null });
    expect(database.executions[0]?.query).toContain("UPDATE oauth_tokens SET revoked_at = ?");
    expect(database.executions[0]?.values[1]).toBe("client-1");
  });

  it("records an audit row", async () => {
    const database = new RecordingD1Database();
    const entry = {
      id: "audit-1",
      client_id: "client-1",
      tool: "create_task",
      target: "task-1",
      status: "ok",
      created_at: CREATED_AT,
    };

    expect(await createD1OAuthRepository(database).insertAudit(entry)).toEqual({ ok: true, value: entry });
    expect(database.executions[0]?.query).toContain("INSERT INTO mcp_audit");
    expect(database.executions[0]?.values).toEqual([
      "audit-1",
      "client-1",
      "create_task",
      "task-1",
      "ok",
      CREATED_AT,
    ]);
  });
});
