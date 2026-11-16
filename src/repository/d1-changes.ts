import { err, ok } from "../task";
import type { Result } from "../task";

/** Minimal D1 surface for mutations (D1Database is assignable). */
export type D1MutationSource = {
  prepare: (sql: string) => {
    bind: (...args: unknown[]) => { run: () => Promise<{ meta?: { changes?: number } }> };
  };
};

/** Number of rows changed by a D1 statement. */
export function changes(result: { meta?: { changes?: number } }): number {
  return result.meta?.changes ?? 0;
}

/** Runs a mutation and maps "no rows changed" to the given NOT_FOUND error. */
export async function runMutation<E>(
  db: D1MutationSource,
  sql: string,
  args: readonly unknown[],
  notFound: E,
): Promise<Result<null, E>> {
  const result = await db.prepare(sql).bind(...args).run();
  return changes(result) === 0 ? err(notFound) : ok(null);
}
