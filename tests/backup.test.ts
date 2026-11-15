import { describe, expect, it } from "vite-plus/test";
import {
  BACKUP_MANIFEST_KEY,
  BACKUP_TABLE_QUERY,
  backupKey,
  buildDump,
  gunzip,
  gzip,
  pruneBackups,
  renderSqlDump,
  runBackup,
  sha256Hex,
} from "../src/backup";
import type { BackupBucket, DumpSource, DumpTable } from "../src/backup";
import { decryptBackup } from "../src/backup-crypto";

// BDD-TM-046: 日次アーカイブの作成・暗号化・保持を検証する。

type Row = Record<string, unknown>;

function createBucket(initial: Record<string, Uint8Array> = {}): BackupBucket & { store: Map<string, Uint8Array> } {
  const store = new Map(Object.entries(initial));
  return {
    store,
    put: async (key, value) => {
      store.set(key, value);
      return {};
    },
    get: async (key) => {
      const value = store.get(key);
      if (value === undefined) return null;
      return { text: async () => new TextDecoder().decode(value) };
    },
    list: async (options) => {
      const prefix = options?.prefix ?? "";
      return { objects: [...store.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key })), truncated: false };
    },
    delete: async (key) => {
      store.delete(key);
    },
  };
}

function createDb(tables: Record<string, { ddl: string; columns: string[]; rows: Row[] }>): DumpSource {
  return {
    prepare: (query) => ({
      all: async () => {
        if (query === BACKUP_TABLE_QUERY) {
          return { results: Object.entries(tables).map(([name, table]) => ({ name, sql: table.ddl })) };
        }
        const pragma = /^PRAGMA table_info\("(.+)"\)$/.exec(query);
        if (pragma !== null) {
          const table = tables[pragma[1] ?? ""];
          return { results: (table?.columns ?? []).map((name) => ({ name })) };
        }
        const select = /^SELECT \* FROM "(.+)"$/.exec(query);
        if (select !== null) {
          return { results: tables[select[1] ?? ""]?.rows ?? [] };
        }
        throw new Error(`unexpected query: ${query}`);
      },
    }),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const TASKS_TABLE = {
  ddl: 'CREATE TABLE "tasks" (id text primary key, title text, done integer, blob blob, empty text)',
  columns: ["id", "title", "done", "blob", "empty"],
  rows: [
    { id: "t1", title: "it's a task", done: 0, blob: new Uint8Array([1, 255]), empty: null },
    { id: "t2", title: "line\nbreak", done: 1, blob: null, empty: null },
  ],
};
const EMPTY_TABLE = { ddl: 'CREATE TABLE "empty_table" (id text primary key)', columns: ["id"], rows: [] };
const TABLES: Record<string, { ddl: string; columns: string[]; rows: Row[] }> = {
  tasks: TASKS_TABLE,
  empty_table: EMPTY_TABLE,
};

describe("renderSqlDump", () => {
  it("renders replaceable DDL and escaped INSERT statements", () => {
    const tables: DumpTable[] = [
      { name: "tasks", ddl: TASKS_TABLE.ddl, columns: TASKS_TABLE.columns, rows: TASKS_TABLE.rows },
      { name: "empty_table", ddl: EMPTY_TABLE.ddl, columns: EMPTY_TABLE.columns, rows: [] },
    ];
    const sql = renderSqlDump(tables);

    expect(sql).toContain('DROP TABLE IF EXISTS "tasks";');
    expect(sql).toContain('CREATE TABLE "tasks"');
    expect(sql).toContain(`INSERT INTO "tasks" ("id", "title", "done", "blob", "empty") VALUES ('t1', 'it''s a task', 0, X'01ff', NULL);`);
    expect(sql).toContain("line\nbreak");
    expect(sql).toContain('DROP TABLE IF EXISTS "empty_table";');
    expect(sql).not.toContain('INSERT INTO "empty_table"');
  });
});

describe("buildDump", () => {
  it("reads the DDL, columns and rows of every table", async () => {
    const tables = await buildDump(createDb(TABLES));

    expect(tables.map((table) => table.name).sort()).toEqual(["empty_table", "tasks"]);
    expect(tables[0]?.rows).toHaveLength(2);
    expect(tables[0]?.columns).toContain("title");
  });
});

describe("gzip", () => {
  it("round-trips bytes", async () => {
    const source = new TextEncoder().encode("compress me".repeat(20));
    expect(new TextDecoder().decode(await gunzip(await gzip(source)))).toBe("compress me".repeat(20));
  });
});

describe("backupKey", () => {
  it("uses the UTC date", () => {
    expect(backupKey(new Date("2026-11-16T00:30:00.000Z"))).toBe("d1/2026/11/16/siftq.sql.gz.enc");
  });
});

describe("runBackup", () => {
  it("stores an encrypted archive and records it in the manifest", async () => {
    const bucket = createBucket();
    const result = await runBackup(
      { DB: createDb(TABLES), BACKUPS: bucket, SESSION_SECRET: "secret" },
      new Date("2026-11-16T00:00:00.000Z"),
    );

    expect(result.key).toBe("d1/2026/11/16/siftq.sql.gz.enc");
    expect(result.rows).toBe(2);
    const payload = bucket.store.get(result.key);
    expect(payload).toBeDefined();
    const decrypted = await decryptBackup(payload ?? new Uint8Array(), "secret");
    const sql = new TextDecoder().decode(await gunzip(decrypted.plaintext));
    expect(sql).toContain('INSERT INTO "tasks"');

    const manifestText = bucket.store.get(BACKUP_MANIFEST_KEY);
    expect(manifestText).toBeDefined();
    const manifest: unknown = JSON.parse(new TextDecoder().decode(manifestText));
    const entries = isRecord(manifest) && Array.isArray(manifest["entries"]) ? manifest["entries"] : [];
    expect(entries).toHaveLength(1);
    const entry = entries[0];
    if (!isRecord(entry)) throw new Error("manifest entry is missing");
    expect(entry["key"]).toBe(result.key);
    expect(entry["keyId"]).toBe(result.keyId);
    expect(entry["sha256"]).toBe(await sha256Hex(new TextEncoder().encode(sql)));
  });

  it("prunes archives older than the retention window", async () => {
    const bucket = createBucket({
      "d1/2026/10/01/siftq.sql.gz.enc": new Uint8Array([1]),
      "d1/2026/11/15/siftq.sql.gz.enc": new Uint8Array([2]),
    });
    const result = await runBackup(
      { DB: createDb(TABLES), BACKUPS: bucket, SESSION_SECRET: "secret" },
      new Date("2026-11-16T00:00:00.000Z"),
    );

    expect(result.pruned).toContain("d1/2026/10/01/siftq.sql.gz.enc");
    expect(bucket.store.has("d1/2026/10/01/siftq.sql.gz.enc")).toBe(false);
    expect(bucket.store.has("d1/2026/11/15/siftq.sql.gz.enc")).toBe(true);
  });

  it("fails when the bindings are missing", async () => {
    await expect(runBackup({}, new Date())).rejects.toThrow("backup bindings are not configured");
  });
});

describe("pruneBackups", () => {
  it("keeps archives inside the window and deletes the rest", async () => {
    const bucket = createBucket({
      "d1/2026/10/01/siftq.sql.gz.enc": new Uint8Array([1]),
      "d1/2026/11/01/siftq.sql.gz.enc": new Uint8Array([2]),
      "d1/2026/11/16/siftq.sql.gz.enc": new Uint8Array([3]),
    });
    const deleted = await pruneBackups(bucket, new Date("2026-11-16T00:00:00.000Z"));

    expect(deleted).toEqual(["d1/2026/10/01/siftq.sql.gz.enc"]);
    expect(bucket.store.size).toBe(2);
  });
});
