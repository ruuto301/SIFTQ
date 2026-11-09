import { spawnSync } from "node:child_process";

export type SandboxInfo = {
  name: string;
  host: string;
  workspace: string | null;
  status: string | null;
};

export type SandboxList = {
  hosts: string[];
  sandboxes: SandboxInfo[];
  error: string | null;
};

type SandboxRecord = Record<string, unknown>;

function isRecord(value: unknown): value is SandboxRecord {
  return typeof value === "object" && value !== null;
}

export function toSandboxPath(hostPath: string): string | null {
  const normalized = hostPath.trim().replace(/\\/g, "/");
  if (normalized === "") return null;
  const drive = /^([A-Za-z]):\/(.*)$/.exec(normalized);
  if (drive !== null) {
    const letter = drive[1];
    const rest = drive[2];
    if (letter === undefined || rest === undefined) return null;
    return "/" + letter.toLowerCase() + "/" + rest;
  }
  return normalized.startsWith("/") ? normalized : null;
}

export function parseSandboxes(value: unknown): SandboxInfo[] {
  if (!Array.isArray(value)) return [];
  const sandboxes: SandboxInfo[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!isRecord(item)) continue;
    const name = item["name"];
    if (typeof name !== "string" || !/^[A-Za-z0-9._-]+$/.test(name)) continue;
    const host = name + ".sbx";
    if (seen.has(host)) continue;
    seen.add(host);
    const workspaces = item["workspaces"];
    const first =
      Array.isArray(workspaces) && typeof workspaces[0] === "string" ? workspaces[0] : null;
    sandboxes.push({
      name,
      host,
      workspace: first === null ? null : toSandboxPath(first),
      status: typeof item["status"] === "string" ? item["status"] : null,
    });
  }
  return sandboxes.sort((left, right) => left.host.localeCompare(right.host));
}

export function parseSandboxNames(value: unknown): string[] {
  return parseSandboxes(value).map((sandbox) => sandbox.host);
}

function candidateBins(): string[] {
  const configured = process.env["POC_SBX_BIN"];
  if (configured !== undefined && configured !== "") return [configured];
  if (process.platform === "win32") return ["sbx", "sbx.exe"];
  return ["sbx"];
}

let cache: { at: number; value: SandboxList } | null = null;
const CACHE_MS = 5000;

export function readSandboxes(): SandboxList {
  const now = Date.now();
  if (cache !== null && now - cache.at < CACHE_MS) return cache.value;

  let lastError: string | null = null;
  for (const bin of candidateBins()) {
    const result = spawnSync(bin, ["ls", "--json"], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 15000,
    });
    if (result.error) {
      lastError = result.error.message.includes("ENOENT") ? "sbx が見つかりません" : result.error.message;
      continue;
    }
    if (result.status !== 0) {
      lastError = (result.stderr ?? "").trim() || "sbx ls failed (exit " + String(result.status) + ")";
      continue;
    }
    try {
      const parsed: unknown = JSON.parse(result.stdout ?? "");
      const sandboxes = parseSandboxes(parsed);
      const value: SandboxList = {
        hosts: sandboxes.map((sandbox) => sandbox.host),
        sandboxes,
        error: null,
      };
      cache = { at: now, value };
      return value;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  const value: SandboxList = { hosts: [], sandboxes: [], error: lastError ?? "sbx ls failed" };
  cache = { at: now, value };
  return value;
}

export function sandboxWorkspaceForHost(host: string): string | null {
  const trimmed = host.trim();
  if (trimmed === "") return null;
  const found = readSandboxes().sandboxes.find((sandbox) => sandbox.host === trimmed);
  return found?.workspace ?? null;
}
