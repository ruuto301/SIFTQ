import { describe, expect, it } from "vite-plus/test";
import { changes, runMutation } from "../src/repository/d1-changes";
import type { D1MutationSource } from "../src/repository/d1-changes";

function dbWith(changedRows: number, onBind?: (args: readonly unknown[]) => void): D1MutationSource {
  return {
    prepare: () => ({
      bind: (...args: unknown[]) => ({
        run: async () => {
          onBind?.(args);
          return { meta: { changes: changedRows } };
        },
      }),
    }),
  };
}

describe("changes", () => {
  it("reads the changed row count from the D1 meta", () => {
    expect(changes({ meta: { changes: 3 } })).toBe(3);
    expect(changes({ meta: {} })).toBe(0);
  });
});

describe("runMutation", () => {
  it("returns the given error when no row changed", async () => {
    const result = await runMutation(dbWith(0), "DELETE FROM ideas WHERE id = ?", ["note-1"], { code: "NOT_FOUND" });
    expect(result).toEqual({ ok: false, error: { code: "NOT_FOUND" } });
  });

  it("binds the args and resolves when a row changed", async () => {
    const bindings: unknown[][] = [];
    const result = await runMutation(dbWith(1, (args) => bindings.push([...args])), "DELETE FROM ideas WHERE id = ?", ["note-1"], { code: "NOT_FOUND" });
    expect(result).toEqual({ ok: true, value: null });
    expect(bindings).toEqual([["note-1"]]);
  });
});
