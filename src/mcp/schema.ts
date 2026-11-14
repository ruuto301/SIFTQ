/** Builds a JSON Schema object for an MCP tool input. */
export function schema(properties: Record<string, unknown>, required: readonly string[] = []): Record<string, unknown> {
  return { type: "object", properties, required: [...required], additionalProperties: false };
}

export const TASK_STATUS_SCHEMA = { type: "string", enum: ["do", "done", "skip"] };

export function isArgs(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readString(args: Record<string, unknown>, key: string): string | null {
  const value = args[key];
  if (value === undefined) return null;
  return typeof value === "string" ? value : null;
}

export function readOptionalNumber(args: Record<string, unknown>, key: string): number | null {
  const value = args[key];
  if (value === undefined) return null;
  return typeof value === "number" && Number.isSafeInteger(value) ? value : null;
}

export function readOptionalBoolean(args: Record<string, unknown>, key: string): boolean | null {
  const value = args[key];
  if (value === undefined) return null;
  return typeof value === "boolean" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type OrderUpdate = { id: string; order: number };

export type VersionInput = { id: string; version: number };

type NumberedEntry = { id: string; value: number };

function readPositiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

/** Reads a non-empty list of uniquely identified entries with one positive integer each. */
function readNumberedEntries(
  value: unknown,
  read: (entry: Record<string, unknown>) => number | null,
  maximum = Number.MAX_SAFE_INTEGER,
): NumberedEntry[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > maximum) return null;
  const entries: NumberedEntry[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (!isRecord(entry)) return null;
    const id = entry["id"];
    if (typeof id !== "string" || id === "") return null;
    const number = read(entry);
    if (number === null) return null;
    if (seen.has(id)) return null;
    seen.add(id);
    entries.push({ id, value: number });
  }
  return entries;
}

export function readOrderUpdates(value: unknown): OrderUpdate[] | null {
  const entries = readNumberedEntries(value, (entry) => readPositiveInteger(entry["order"]));
  return entries?.map((entry) => ({ id: entry.id, order: entry.value })) ?? null;
}

export function readVersionInputs(value: unknown): VersionInput[] | null {
  const entries = readNumberedEntries(value, (entry) => readPositiveInteger(entry["version"]), 50);
  return entries?.map((entry) => ({ id: entry.id, version: entry.value })) ?? null;
}
