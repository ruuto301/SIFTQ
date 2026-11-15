import { describe, expect, it } from "vite-plus/test";
import type { D1Database, D1PreparedStatement, D1Result } from "@cloudflare/workers-types";
import { createD1ProjectRepository } from "../src/repository/d1-project-repository";
import type { Project } from "../src/project";

type Execution = { query: string; values: readonly unknown[] };

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

  first<T = Record<string, unknown>>(_colName?: string): Promise<T | null> {
    this.recorder.record(this.query, this.values);
    return Promise.resolve(null);
  }

  run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    this.recorder.record(this.query, this.values);
    return Promise.resolve(successResult<T>([], this.recorder.runChanges));
  }

  all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    this.recorder.record(this.query, this.values);
    const rows = this.recorder.resultSets.shift();
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
  readonly resultSets: unknown[] = [];
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

function projectRow(id: string, sortOrder: number): Record<string, unknown> {
  return { id, name: id.toUpperCase(), sort_order: sortOrder };
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

  it("updates sort_order in one batch and returns the reordered list", async () => {
    const database = new RecordingD1Database();
    database.resultSets.push(
      [projectRow("a", 1), projectRow("b", 2)],
      [projectRow("a", 2), projectRow("b", 1)],
    );

    const moved = await createD1ProjectRepository(database).move([
      { id: "a", order: 2 },
      { id: "b", order: 1 },
    ]);

    expect(moved).toEqual({
      ok: true,
      value: [
        { id: "b", name: "B", sort_order: 1 },
        { id: "a", name: "A", sort_order: 2 },
      ],
    });
    const updates = database.executions.filter((execution) =>
      execution.query.includes("UPDATE projects SET sort_order = ?"),
    );
    expect(updates.map((execution) => execution.values)).toEqual([
      [2, "a"],
      [1, "b"],
    ]);
  });

  it("rejects an unknown project id without issuing updates", async () => {
    const database = new RecordingD1Database();
    database.resultSets.push([projectRow("a", 1)]);

    const moved = await createD1ProjectRepository(database).move([{ id: "missing", order: 1 }]);

    expect(moved).toEqual({ ok: false, error: { code: "INVALID_PROJECT" } });
    expect(
      database.executions.some((execution) => execution.query.startsWith("UPDATE")),
    ).toBe(false);
  });
});

describe("D1 project repository writes", () => {
  it("inserts a project and reports a duplicated id", async () => {
    const database = new RecordingD1Database();
    const repository = createD1ProjectRepository(database);
    const project: Project = { id: "c", name: "C", sort_order: 3 };

    expect(await repository.insert(project)).toEqual({ ok: true, value: project });
    expect(database.executions[0]?.query).toContain("INSERT OR IGNORE INTO projects");
    expect(database.executions[0]?.values).toEqual(["c", "C", 3]);

    database.runChanges = 0;
    expect(await repository.insert(project)).toEqual({ ok: false, error: { code: "CONFLICT" } });
  });

  it("updates a project and reports an unknown id", async () => {
    const database = new RecordingD1Database();
    const repository = createD1ProjectRepository(database);
    const project: Project = { id: "c", name: "C", sort_order: 3 };

    expect(await repository.update(project)).toEqual({ ok: true, value: project });
    expect(database.executions[0]?.query).toContain("UPDATE projects SET name = ?");
    expect(database.executions[0]?.values).toEqual(["C", 3, "c"]);

    database.runChanges = 0;
    expect(await repository.update(project)).toEqual({ ok: false, error: { code: "NOT_FOUND" } });
  });

  it("removes a project and reports an unknown id", async () => {
    const database = new RecordingD1Database();
    const repository = createD1ProjectRepository(database);

    expect(await repository.remove("c")).toEqual({ ok: true, value: null });
    expect(database.executions[0]?.query).toContain("DELETE FROM projects WHERE id = ?");
    expect(database.executions[0]?.values).toEqual(["c"]);

    const missing = new RecordingD1Database();
    missing.runChanges = 0;
    expect(await createD1ProjectRepository(missing).remove("c")).toEqual({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });
});
