import { describe, expect, it } from "vite-plus/test";
import type { D1Database, D1PreparedStatement, D1Result } from "@cloudflare/workers-types";
import { createMemoryTaskRepository } from "./helpers/memory-task-repository";
import { taskFixture } from "./helpers/task-fixture";
import { createD1TaskRepository } from "../src/repository/d1-task-repository";
import type { TaskRepository } from "../src/repository/task-repository";
import type { Task } from "../src/task";

type Execution = { query: string; values: readonly unknown[] };

function isRowArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}

function successResult<T>(results: T[], changes: number): D1Result<T> {
  return {
    success: true,
    results,
    meta: {
      duration: 0,
      size_after: 0,
      rows_read: 0,
      rows_written: 0,
      last_row_id: 0,
      changed_db: changes > 0,
      changes,
    },
  };
}

interface StatementRecorder {
  record(query: string, values: readonly unknown[]): void;
  nextChanges(): number;
  nextRows(): unknown;
}

class RecordingPreparedStatement implements D1PreparedStatement {
  private values: readonly unknown[] = [];

  constructor(
    private readonly recorder: StatementRecorder,
    private readonly query: string,
  ) {}

  bind(...values: unknown[]): D1PreparedStatement {
    this.values = values;
    return this;
  }

  first<T = Record<string, unknown>>(_colName?: string): Promise<T | null> {
    return Promise.reject(new Error("first is not implemented in this test double"));
  }

  run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    this.recordExecution();
    return Promise.resolve(successResult<T>([], this.recorder.nextChanges()));
  }

  recordExecution(): void {
    this.recorder.record(this.query, this.values);
  }

  all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    this.recordExecution();
    const rows = this.recorder.nextRows();
    return Promise.resolve(successResult<T>(isRowArray<T>(rows) ? rows : [], this.recorder.nextChanges()));
  }

  raw<T = unknown[]>(
    _options: { columnNames: true },
  ): Promise<[string[], ...T[]]>;
  raw<T = unknown[]>(_options?: { columnNames?: false }): Promise<T[]>;
  raw<T = unknown[]>(_options?: { columnNames?: boolean }): Promise<T[]> {
    return Promise.reject(new Error("raw is not implemented in this test double"));
  }
}

class RecordingD1Database implements D1Database, StatementRecorder {
  readonly executions: Execution[] = [];
  readonly resultRows: unknown[] = [];
  private readonly prepared: RecordingPreparedStatement[] = [];
  private changes: number[];

  constructor(changes: number[] = [1]) {
    this.changes = [...changes];
  }

  prepare(query: string): D1PreparedStatement {
    const statement = new RecordingPreparedStatement(this, query);
    this.prepared.push(statement);
    return statement;
  }

  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    const batch = this.prepared.slice(-statements.length);
    for (const statement of batch) {
      statement.recordExecution();
    }
    return Promise.resolve(batch.map(() => successResult<T>([], this.nextChanges())));
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

  nextChanges(): number {
    return this.changes.shift() ?? 1;
  }

  nextRows(): unknown {
    return this.resultRows.shift();
  }
}

function expectInsertExecution(execution: Execution | undefined, task: Task): void {
  expect(execution?.query).toContain("INSERT INTO tasks");
  expect(execution?.values).toEqual([
    task.id,
    "local",
    task.title,
    task.description,
    task.status,
    0,
    task.project,
    task.order,
    task.version,
    task.created_at,
    task.updated_at,
  ]);
}

const unusedD1Database = {
  prepare() {
    throw new Error("D1 is not used by this factory contract test.");
  },
  batch() {
    throw new Error("D1 is not used by this factory contract test.");
  },
  exec() {
    throw new Error("D1 is not used by this factory contract test.");
  },
  withSession() {
    throw new Error("D1 is not used by this factory contract test.");
  },
  dump() {
    throw new Error("D1 is not used by this factory contract test.");
  },
} satisfies D1Database;

const repositoryMethods = ["bulkRemove", "bulkUpdateProject", "bulkUpdateStatus", "clearProject", "find", "insert", "list", "move", "remove", "update"];

describe("TaskRepository contract", () => {
  it("inserts and reads a task through the in-memory double", async () => {
    const repository = createMemoryTaskRepository();
    const task = taskFixture({ id: "task-1" });

    const inserted = await repository.insert(task);
    const listed = await repository.list();

    expect(inserted.ok).toBe(true);
    expect(listed.ok).toBe(true);
    if (!inserted.ok || !listed.ok) return;
    expect(inserted.value.id).toBe("task-1");
    expect(listed.value.map((item) => item.id)).toContain("task-1");
  });

  it("exposes the contract from both repository factories", () => {
    const repositories: TaskRepository[] = [
      createMemoryTaskRepository(),
      createD1TaskRepository(unusedD1Database),
    ];

    for (const repository of repositories) {
      expect(Object.keys(repository).sort()).toEqual(repositoryMethods);
    }
  });

  it("maps inserts through the D1 adapter", async () => {
    const database = new RecordingD1Database([1, 1]);
    const repository = createD1TaskRepository(database);
    const task = taskFixture({ id: "task-1", version: 1 });

    const inserted = await repository.insert(task);

    expect(inserted.ok).toBe(true);
    expect(database.executions).toHaveLength(1);
    expectInsertExecution(database.executions[0], task);
  });

  it("maps updates through the D1 adapter", async () => {
    const database = new RecordingD1Database([1]);
    const repository = createD1TaskRepository(database);
    const task = taskFixture({ id: "task-1", version: 1 });

    const updated = await repository.update(task);

    expect(updated.ok).toBe(true);
    expect(database.executions[0]?.query).toContain("UPDATE tasks SET title");
  });

  it("returns conflicts from failed D1 updates", async () => {
    const updateDatabase = new RecordingD1Database([0]);
    const updateRepository = createD1TaskRepository(updateDatabase);
    const task = taskFixture({ id: "task-1", version: 1 });

    const updated = await updateRepository.update(task);

    expect(updated).toEqual({ ok: false, error: { code: "CONFLICT" } });
  });

  it("writes the project column on update", async () => {
    const database = new RecordingD1Database([1]);
    const repository = createD1TaskRepository(database);

    const updated = await repository.update(taskFixture({ id: "task-1", project: "dsh", version: 1 }));

    expect(updated.ok).toBe(true);
    expect(database.executions[0]?.query).toContain("project = ?");
    expect(database.executions[0]?.values).toContain("dsh");
  });
});

describe("Task list ordering by updated_at", () => {
  it("lists the most recently updated task first through the in-memory double", async () => {
    const repository = createMemoryTaskRepository();
    await repository.insert(taskFixture({ id: "old", updated_at: "2026-01-01T00:00:00.000Z" }));
    await repository.insert(taskFixture({ id: "new", updated_at: "2026-03-01T00:00:00.000Z" }));
    await repository.insert(taskFixture({ id: "mid", updated_at: "2026-02-01T00:00:00.000Z" }));

    const listed = await repository.list();

    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.map((task) => task.id)).toEqual(["new", "mid", "old"]);
  });

  it("orders the D1 task list query by updated_at descending", async () => {
    const database = new RecordingD1Database([1]);
    const repository = createD1TaskRepository(database);

    const listed = await repository.list();

    expect(listed.ok).toBe(true);
    expect(database.executions[0]?.query).toContain("ORDER BY updated_at DESC");
  });
});

function taskRow(task: Task): Record<string, unknown> {
  return { ...task, working: task.working ? 1 : 0 };
}

describe("Memory task reorder", () => {
  it("moves tasks without touching version or updated_at", async () => {
    const repository = createMemoryTaskRepository();
    await repository.insert(
      taskFixture({ id: "task-1", order: 1, version: 3, updated_at: "2026-01-01T00:00:00.000Z" }),
    );
    await repository.insert(
      taskFixture({ id: "task-2", order: 2, version: 5, updated_at: "2026-02-01T00:00:00.000Z" }),
    );

    const moved = await repository.move([
      { id: "task-2", order: 1 },
      { id: "task-1", order: 2 },
    ]);

    expect(moved).toEqual({
      ok: true,
      value: [
        expect.objectContaining({ id: "task-2", order: 1, version: 5, updated_at: "2026-02-01T00:00:00.000Z" }),
        expect.objectContaining({ id: "task-1", order: 2, version: 3, updated_at: "2026-01-01T00:00:00.000Z" }),
      ],
    });
    const listed = await repository.list();
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    const orders = new Map(listed.value.map((task) => [task.id, task.order]));
    expect(orders.get("task-2")).toBe(1);
    expect(orders.get("task-1")).toBe(2);
  });

  it("rejects an unknown task id without changing any order", async () => {
    const repository = createMemoryTaskRepository();
    await repository.insert(taskFixture({ id: "task-1", order: 1 }));

    const moved = await repository.move([
      { id: "task-1", order: 2 },
      { id: "missing", order: 1 },
    ]);

    expect(moved).toEqual({ ok: false, error: { code: "NOT_FOUND" } });
    const listed = await repository.list();
    expect(listed).toEqual({
      ok: true,
      value: [expect.objectContaining({ id: "task-1", order: 1 })],
    });
  });
});

describe("D1 task reorder", () => {
  it("updates only the order column in one batch", async () => {
    const database = new RecordingD1Database([1, 1, 1]);
    database.resultRows.push([
      taskRow(taskFixture({ id: "task-1", order: 1, version: 3 })),
      taskRow(taskFixture({ id: "task-2", order: 2, version: 5 })),
    ]);

    const moved = await createD1TaskRepository(database).move([
      { id: "task-2", order: 1 },
      { id: "task-1", order: 2 },
    ]);

    expect(moved).toEqual({
      ok: true,
      value: [
        expect.objectContaining({ id: "task-2", order: 1, version: 5 }),
        expect.objectContaining({ id: "task-1", order: 2, version: 3 }),
      ],
    });
    const updates = database.executions.filter((execution) => execution.query.startsWith("UPDATE tasks"));
    expect(updates.map((execution) => execution.values)).toEqual([
      [1, "task-2", "local"],
      [2, "task-1", "local"],
    ]);
    expect(
      updates.every(
        (execution) => !execution.query.includes("version") && !execution.query.includes("updated_at"),
      ),
    ).toBe(true);
  });

  it("rejects an unknown task id without issuing D1 updates", async () => {
    const database = new RecordingD1Database([1]);
    database.resultRows.push([taskRow(taskFixture({ id: "task-1", order: 1 }))]);

    const moved = await createD1TaskRepository(database).move([{ id: "missing", order: 1 }]);

    expect(moved).toEqual({ ok: false, error: { code: "NOT_FOUND" } });
    expect(database.executions.some((execution) => execution.query.startsWith("UPDATE"))).toBe(false);
  });
});
