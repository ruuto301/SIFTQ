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

export function readStringArray(args: Record<string, unknown>, key: string): string[] | null {
  const value = args[key];
  if (!Array.isArray(value)) return null;
  const items: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") return null;
    items.push(item);
  }
  return items;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type OrderUpdate = { id: string; order: number };

export function readOrderUpdates(value: unknown): OrderUpdate[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const updates: OrderUpdate[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (!isRecord(entry)) return null;
    const id = entry["id"];
    const order = entry["order"];
    if (typeof id !== "string" || id === "") return null;
    if (typeof order !== "number" || !Number.isSafeInteger(order) || order <= 0) return null;
    if (seen.has(id)) return null;
    seen.add(id);
    updates.push({ id, order });
  }
  return updates;
}

export type VersionInput = { id: string; version: number };

export function readVersionInputs(value: unknown): VersionInput[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 50) return null;
  const inputs: VersionInput[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (!isRecord(entry)) return null;
    const id = entry["id"];
    const version = entry["version"];
    if (typeof id !== "string" || id === "") return null;
    if (typeof version !== "number" || !Number.isSafeInteger(version) || version <= 0) return null;
    if (seen.has(id)) return null;
    seen.add(id);
    inputs.push({ id, version });
  }
  return inputs;
}
