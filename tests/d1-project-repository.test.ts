import { describe, expect, it } from "vite-plus/test";
import type { D1Database, D1PreparedStatement, D1Result } from "@cloudflare/workers-types";
import { createD1ProjectRepository } from "../src/repository/d1-project-repository";

type Execution = { query: string; values: readonly unknown[] };

function successResult<T>(results: T[]): D1Result<T> {
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
      changes: 0,
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

  first<T = Record<string, unknown>>(_colName?: string): Promise<T | null> {
    this.recorder.record(this.query, this.values);
    return Promise.resolve(null);
  }

  run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    this.recorder.record(this.query, this.values);
    return Promise.resolve(successResult<T>([]));
  }

  all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    this.recorder.record(this.query, this.values);
    return Promise.resolve(successResult<T>([]));
  }

  raw<T = unknown[]>(_options: { columnNames: true }): Promise<[string[], ...T[]]>;
  raw<T = unknown[]>(_options?: { columnNames?: false }): Promise<T[]>;
  raw<T = unknown[]>(_options?: { columnNames?: boolean }): Promise<T[]> {
    return Promise.reject(new Error("raw is not implemented in this test double"));
  }
}

class RecordingD1Database implements D1Database {
  readonly executions: Execution[] = [];

  prepare(query: string): D1PreparedStatement {
    return new RecordingPreparedStatement(this, query);
  }

  batch(): Promise<never> {
    return Promise.reject(new Error("batch is not implemented in this test double"));
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

describe("D1 project repository", () => {
  it("orders the list query by sort_order and id", async () => {
    const database = new RecordingD1Database();

    const listed = await createD1ProjectRepository(database).list();

    expect(listed).toEqual({ ok: true, value: [] });
    expect(database.executions[0]?.query).toContain("FROM projects ORDER BY sort_order ASC, id ASC");
  });

  it("finds a project by id and returns undefined for a missing row", async () => {
    const database = new RecordingD1Database();

    const found = await createD1ProjectRepository(database).find("dsh");

    expect(found).toEqual({ ok: true, value: undefined });
    expect(database.executions[0]?.query).toContain("FROM projects WHERE id = ?");
    expect(database.executions[0]?.values).toEqual(["dsh"]);
  });
});
