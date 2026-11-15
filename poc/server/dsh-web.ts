import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { sandboxWorkspaceForHost } from "./sandboxes";
import type { Store } from "./store";
import type { ChatEvent, DshStatus, DshStatusEntry } from "./types";

type DshWebProcess = {
  target: string;
  child: ChildProcessWithoutNullStreams | null;
  status: DshStatus;
  baseUrl: string | null;
  cookie: string | null;
  cwd: string;
  starting: Promise<void> | null;
};

const DEFAULT_PORT_BASE = 8790;

export function parseDshWebUrl(line: string): string | null {
  const match = /dsh web:\s*(https?:\/\/\S+)/.exec(line);
  return match?.[1] ?? null;
}

export function buildIframeUrl(baseUrl: string, sessionId: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set("session", sessionId);
  return url.toString();
}

export class DshWebManager {
  private readonly processes = new Map<string, DshWebProcess>();
  private nextPort = Number(process.env["POC_DSH_WEB_PORT_BASE"] ?? DEFAULT_PORT_BASE);

  constructor(
    private readonly store: Store,
    private readonly emit: (event: ChatEvent) => void,
  ) {}

  async start(): Promise<void> {
    // dsh web は接続先を使うときだけ起動する。起動時には開始しない。
  }

  async stop(): Promise<void> {
    for (const proc of this.processes.values()) {
      proc.child?.kill();
      proc.status = { state: "stopped", profile: "web", target: proc.target };
    }
    this.processes.clear();
  }

  getStatuses(): DshStatusEntry[] {
    return Array.from(this.processes.values()).map((proc) => ({ target: proc.target, status: proc.status }));
  }

  async retry(target?: string): Promise<DshStatusEntry[]> {
    if (target === undefined) {
      for (const proc of this.processes.values()) proc.child?.kill();
      this.processes.clear();
      return this.getStatuses();
    }
    const proc = this.processes.get(target);
    proc?.child?.kill();
    this.processes.delete(target);
    await this.startTarget(target);
    return this.getStatuses();
  }

  async getUiUrl(conversationId: string): Promise<string> {
    const sessionId = await this.ensureSession(conversationId);
    const found = this.store.getConversation(conversationId);
    if (found === null) throw new Error("conversation not found");
    const proc = this.processes.get(this.store.getGroupTarget(found.task.project));
    if (proc?.baseUrl === null || proc === undefined) throw new Error("dsh web is not running");
    return buildIframeUrl(proc.baseUrl, sessionId);
  }

  private allocatePort(): number {
    const port = this.nextPort;
    this.nextPort += 1;
    return port;
  }

  private ensureProcess(target: string): DshWebProcess {
    const existing = this.processes.get(target);
    if (existing !== undefined) return existing;
    const proc: DshWebProcess = {
      target,
      child: null,
      status: { state: "stopped", profile: "web", target },
      baseUrl: null,
      cookie: null,
      cwd: "",
      starting: null,
    };
    this.processes.set(target, proc);
    return proc;
  }

  private async startTarget(target: string): Promise<DshWebProcess> {
    const proc = this.ensureProcess(target);
    if (proc.status.state === "ready") return proc;
    if (proc.starting !== null) {
      await proc.starting;
      return proc;
    }
    proc.starting = this.startInternal(proc);
    try {
      await proc.starting;
    } finally {
      proc.starting = null;
    }
    return proc;
  }

  private async startInternal(proc: DshWebProcess): Promise<void> {
    const target = proc.target;
    const port = this.allocatePort();
    const sshHost = target === "" ? null : target;
    proc.cwd = sshHost === null ? process.cwd() : (sandboxWorkspaceForHost(target) ?? process.env["POC_SSH_CWD"] ?? "");
    this.setStatus(proc, { state: "starting", profile: "web", target });

    const bin = sshHost === null ? (process.env["POC_DSH_BIN"] ?? "dsh") : (process.env["POC_SSH_BIN"] ?? "ssh");
    const args =
      sshHost === null
        ? ["web", "--host", "127.0.0.1", "--port", String(port), "--no-open"]
        : [
            "-L",
            `${port}:127.0.0.1:${port}`,
            sshHost,
            "dsh",
            "web",
            "--host",
            "127.0.0.1",
            "--port",
            String(port),
            "--no-open",
          ];

    const child = spawn(bin, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    proc.child = child;

    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });
    child.on("exit", () => {
      if (proc.child === child) {
        proc.child = null;
        proc.baseUrl = null;
        proc.cookie = null;
        this.setStatus(proc, { state: "stopped", profile: "web", target });
      }
    });
    child.on("error", (error) => {
      if (proc.child === child) {
        proc.child = null;
        proc.baseUrl = null;
        this.setStatus(proc, {
          state: "error",
          profile: "web",
          target,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    const baseUrl = await new Promise<string>((resolve, reject) => {
      let output = "";
      const timer = setTimeout(() => reject(new Error("dsh web の起動がタイムアウトしました")), 20000);
      child.stdout.on("data", (chunk: Buffer) => {
        output += chunk.toString();
        const url = parseDshWebUrl(output);
        if (url !== null) {
          clearTimeout(timer);
          resolve(url);
        }
      });
      child.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(stderr.trim() || "dsh web exited (" + String(code) + ")"));
      });
    }).catch((error: unknown) => {
      this.setStatus(proc, {
        state: "error",
        profile: "web",
        target,
        error: error instanceof Error ? error.message : String(error),
      });
      child.kill();
      proc.child = null;
      throw error;
    });

    proc.baseUrl = baseUrl;
    this.setStatus(proc, { state: "ready", profile: "web", target });
  }

  private setStatus(proc: DshWebProcess, status: DshStatus): void {
    proc.status = status;
    this.emit({ type: "dsh", target: proc.target, status });
  }

  private async ensureSession(conversationId: string): Promise<string> {
    const found = this.store.getConversation(conversationId);
    if (found === null) throw new Error("conversation not found");
    const groupTarget = this.store.getGroupTarget(found.task.project);
    const storedTarget = found.conversation.dshTarget;
    if (storedTarget !== null && storedTarget !== "" && storedTarget !== groupTarget) {
      this.store.resetConversationDsh(conversationId);
    }

    const proc = await this.startTarget(groupTarget);
    const existing = found.conversation.dshSessionId;
    if (existing !== null && found.conversation.dshTarget === groupTarget) {
      return existing;
    }

    const sessionId = await this.createSession(proc, proc.cwd);
    this.store.setSessionId(conversationId, sessionId);
    if (groupTarget !== "") this.store.setDshTarget(conversationId, groupTarget);
    return sessionId;
  }

  private async createSession(proc: DshWebProcess, cwd: string): Promise<string> {
    if (proc.baseUrl === null) throw new Error("dsh web is not running");
    const base = new URL(proc.baseUrl);
    const origin = base.origin;
    const token = base.searchParams.get("token");
    if (token === null || token === "") throw new Error("dsh web token not found");

    const connect = await fetch(`${origin}/connect?token=${encodeURIComponent(token)}&interactions=none`, {
      redirect: "manual",
    });
    if (connect.status !== 302) throw new Error("dsh web connect failed: " + String(connect.status));
    const setCookie = connect.headers.get("set-cookie");
    const cookie = setCookie === null ? (proc.cookie ?? "") : (setCookie.split(";")[0] ?? "");
    proc.cookie = cookie;

    const response = await fetch(`${origin}/api/session/create`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(cookie === "" ? {} : { cookie }),
      },
      body: JSON.stringify({
        type: "client-request",
        rpcId: randomUUID(),
        method: "session/create",
        payload: { args: { request: { cwd: cwd === "" ? process.cwd() : cwd } } },
      }),
    });
    const payload: unknown = await response.json().catch(() => null);
    const sessionId = extractSessionId(payload);
    if (sessionId === null) {
      throw new Error("dsh web session create failed: " + JSON.stringify(payload).slice(0, 500));
    }
    return sessionId;
  }
}

function extractSessionId(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const record = payload as Record<string, unknown>;
  const result = record["result"];
  if (typeof result === "object" && result !== null) {
    const resultRecord = result as Record<string, unknown>;
    const value = resultRecord["value"];
    if (typeof value === "object" && value !== null) {
      const sessionId = (value as Record<string, unknown>)["sessionId"];
      if (typeof sessionId === "string") return sessionId;
    }
    const direct = resultRecord["sessionId"];
    if (typeof direct === "string") return direct;
  }
  const direct = record["sessionId"];
  return typeof direct === "string" ? direct : null;
}
