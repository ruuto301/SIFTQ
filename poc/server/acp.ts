import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { Readable, Writable } from "node:stream";
import {
  PROTOCOL_VERSION,
  client,
  ndJsonStream,
  type ClientConnection,
  type RequestPermissionRequest,
  type RequestPermissionResponse,
  type SessionNotification,
} from "@agentclientprotocol/sdk";
import { configOptionsFromAcp } from "./config";
import { sandboxWorkspaceForHost } from "./sandboxes";
import type { Store } from "./store";
import type { ChatEvent, ChatMessage, ConfigOption, DshStatus, DshStatusEntry, Task } from "./types";

type RuntimeMode = "real" | "mock";

type PendingPermission = {
  conversationId: string;
  resolve: (response: RequestPermissionResponse) => void;
};

type CurrentAssistant = {
  messageId: string;
  content: string;
  status: "streaming" | "done" | "stopped";
};

function newId(prefix: string): string {
  return prefix + "-" + crypto.randomUUID();
}

function messageError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function mockReply(userText: string, task: Task): string {
  const browser = task.browserTabs.find((tab) => tab.active) ?? task.browserTabs[0];
  const memo = task.memo ? "メモ（" + task.memo.length + "文字）" : "メモ（空）";
  const browserLine = browser ? "ブラウザ（" + browser.url + "）" : "ブラウザ（未選択）";
  if (/メモ/.test(userText)) {
    return (
      "メモを確認しました。\n\n" +
      (task.memo || "（メモはまだ空です）") +
      "\n\nこの内容をもとに、次の3点に整理できます。\n- 目的\n- 次の操作\n- 保留にしたこと"
    );
  }
  if (/ブラウザ|ページ|開いて/.test(userText)) {
    return (
      "現在のブラウザの状態を確認しました。\n\n- URL: " +
      (browser ? browser.url : "未選択") +
      "\n- タイトル: " +
      (browser ? browser.title : "未選択") +
      "\n\nこのページを前提に作業を進めます。プロトタイプではページ本文の取得はモックです。"
    );
  }
  if (/タスク/.test(userText)) {
    return (
      "タスクにできる形に整理しました。\n\n1. " +
      userText.slice(0, 40) +
      "\n2. 関連するブラウザのタブを確認する\n3. 完了条件を決める\n\n必要ならこの応答から「タスクにする」で起票できます。"
    );
  }
  return (
    "受け取りました。\n\n参照した文脈:\n- " +
    memo +
    "\n- " +
    browserLine +
    "\n\nプロトタイプのため応答は固定です。実装時はここにLLMの応答とツール実行ログが入ります。"
  );
}

export class DshRuntime {
  private readonly mode: RuntimeMode;
  private readonly bin: string;
  private readonly profile: string;
  private readonly target: string;
  private readonly cwd: string;
  private sessionCwd: string;
  private child: ChildProcessWithoutNullStreams | null = null;
  private connection: ClientConnection | null = null;
  private status: DshStatus;
  private stderr = "";
  private readonly activeSessions = new Set<string>();
  private readonly sessionToConversation = new Map<string, string>();
  private readonly conversationToSession = new Map<string, string>();
  private readonly activePrompts = new Set<string>();
  private readonly currentAssistant = new Map<string, CurrentAssistant>();
  private readonly toolMessages = new Map<string, Map<string, string>>();
  private readonly pendingPermissions = new Map<string, PendingPermission>();
  private readonly mockTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private startPromise: Promise<void> | null = null;

  constructor(
    private readonly store: Store,
    private readonly emit: (event: ChatEvent) => void,
    options: { mode?: RuntimeMode; bin?: string; profile?: string; target?: string; cwd?: string } = {},
  ) {
    this.mode = options.mode ?? "real";
    this.bin = options.bin ?? process.env["POC_DSH_BIN"] ?? "dsh";
    this.profile = options.profile ?? process.env["POC_DSH_PROFILE"] ?? "acp";
    this.target = options.target ?? "";
    this.cwd = options.cwd ?? "";
    this.sessionCwd = process.cwd();
    this.status = {
      state: this.mode === "mock" ? "mock" : "starting",
      profile: this.profile,
      target: this.target,
    };
  }

  getStatus(): DshStatus {
    return this.status;
  }

  isBusy(conversationId: string): boolean {
    return this.activePrompts.has(conversationId);
  }

  start(): Promise<void> {
    if (this.startPromise !== null) return this.startPromise;
    this.startPromise = this.startInternal();
    return this.startPromise;
  }

  private async startInternal(): Promise<void> {
    if (this.mode === "mock") {
      for (const task of this.store.getPayload().tasks) {
        for (const conversation of task.conversations) this.ensureMockConfig(conversation.id);
      }
      this.setStatus({ state: "mock", profile: "mock", target: this.target });
      return;
    }
    this.setStatus({ state: "starting", profile: this.profile, target: this.target });
    try {
      const sshHost = this.sshHost();
      const sshBin = process.env["POC_SSH_BIN"] ?? "ssh";
      if (sshHost !== null) {
        if (this.cwd !== "") {
          this.sessionCwd = this.cwd;
        } else {
          const probe = spawnSync(sshBin, [sshHost, "pwd"], { encoding: "utf8", windowsHide: true });
          if (probe.error) throw probe.error;
          if (probe.status !== 0 || probe.stdout.trim() === "") {
            throw new Error(probe.stderr.trim() || "ssh " + sshHost + " failed");
          }
          this.sessionCwd = probe.stdout.trim();
        }
      } else {
        this.sessionCwd = process.cwd();
      }
      await this.spawnAndInitialize();
      this.setStatus({ state: "ready", profile: this.profile, target: this.target });
    } catch (error) {
      this.closeChild();
      this.setStatus({ state: "error", profile: this.profile, target: this.target, error: this.errorText(error) });
      throw error;
    }
  }

  async retry(): Promise<void> {
    await this.stop();
    try {
      await this.start();
    } catch {
      // status is already set to error
    }
  }

  async stop(): Promise<void> {
    for (const timer of this.mockTimers.values()) clearTimeout(timer);
    this.mockTimers.clear();
    for (const pending of this.pendingPermissions.values()) {
      pending.resolve({ outcome: { outcome: "cancelled" } });
    }
    this.pendingPermissions.clear();
    this.activeSessions.clear();
    this.sessionToConversation.clear();
    this.conversationToSession.clear();
    this.activePrompts.clear();
    this.currentAssistant.clear();
    this.toolMessages.clear();
    this.closeChild();
    this.startPromise = null;
    if (this.mode !== "mock") this.setStatus({ state: "stopped", profile: this.profile, target: this.target });
  }

  private async waitReady(): Promise<void> {
    if (this.startPromise !== null) await this.startPromise;
    if (this.connection === null) throw new Error("DSH is not connected");
  }

  private closeChild(): void {
    this.connection?.close();
    this.connection = null;
    if (this.child !== null) {
      this.child.kill();
      this.child = null;
    }
  }

  private errorText(error: unknown): string {
    const detail = this.stderr.trim();
    const message = messageError(error);
    return detail === "" ? message : message + "\n" + detail.slice(-4000);
  }

  private setStatus(status: DshStatus): void {
    this.status = status;
    this.emit({ type: "dsh", target: this.target, status });
  }

  private sshHost(): string | null {
    const host = this.target.trim();
    return host === "" ? null : host;
  }

  private async spawnAndInitialize(): Promise<void> {
    const sshHost = this.sshHost();
    const sshBin = process.env["POC_SSH_BIN"] ?? "ssh";
    const remoteBin = process.env["POC_DSH_REMOTE_BIN"] ?? "dsh";
    const child =
      sshHost === null
        ? spawn(this.bin, ["--profile", this.profile], {
            cwd: process.cwd(),
            env: process.env,
            stdio: ["pipe", "pipe", "pipe"],
            windowsHide: true,
          })
        : spawn(sshBin, [sshHost, remoteBin, "--profile", this.profile], {
            cwd: process.cwd(),
            env: process.env,
            stdio: ["pipe", "pipe", "pipe"],
            windowsHide: true,
          });
    this.child = child;
    this.stderr = "";
    const spawned = new Promise<void>((resolve, reject) => {
      child.once("spawn", () => resolve());
      child.once("error", (error) => reject(error));
    });
    const exited = new Promise<never>((_, reject) => {
      child.once("exit", (code, signal) => {
        const detail = this.stderr.trim();
        const suffix = code === null ? (signal ?? "unknown") : String(code);
        reject(new Error(detail !== "" ? detail : "DSH exited (" + suffix + ")"));
      });
    });
    exited.catch(() => undefined);
    child.on("error", (error) => {
      if (this.child !== child) return;
      this.child = null;
      this.connection = null;
      this.activeSessions.clear();
      this.setStatus({
        state: "error",
        profile: this.profile,
        target: this.target,
        error: this.errorText(error),
      });
    });
    child.stderr.on("data", (chunk: Buffer) => {
      this.stderr += chunk.toString();
      if (this.stderr.length > 16000) this.stderr = this.stderr.slice(-16000);
    });
    child.on("exit", () => {
      if (this.child === child) {
        this.child = null;
        this.connection = null;
        this.activeSessions.clear();
        if (this.mode !== "mock" && this.status.state !== "starting") {
          this.setStatus({ state: "stopped", profile: this.profile, target: this.target });
        }
      }
    });

    await spawned;

    const stream = ndJsonStream(Writable.toWeb(child.stdin), Readable.toWeb(child.stdout));
    const app = client({ name: "siftq-poc" })
      .onNotification("session/update", (context) => {
        this.handleUpdate(context.params);
      })
      .onRequest("session/request_permission", (context) => this.handlePermission(context.params, context.signal));
    const connection = app.connect(stream);
    this.connection = connection;

    const timeoutRaw = Number(process.env["POC_DSH_START_TIMEOUT_MS"] ?? "20000");
    const timeoutMs = Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : 20000;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const timedOut = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("DSH の初期化がタイムアウトしました")), timeoutMs);
    });
    timedOut.catch(() => undefined);
    try {
      await Promise.race([
        connection.agent.request("initialize", {
          protocolVersion: PROTOCOL_VERSION,
          clientCapabilities: {
            fs: { readTextFile: false, writeTextFile: false },
            terminal: false,
          },
          clientInfo: { name: "siftq-poc", version: "0.1.0" },
        }),
        exited,
        timedOut,
      ]);
    } finally {
      if (timer !== null) clearTimeout(timer);
    }
  }

  private requireConnection(): ClientConnection {
    if (this.connection === null) throw new Error("DSH is not connected");
    return this.connection;
  }

  private async ensureSession(conversationId: string): Promise<string> {
    const found = this.store.getConversation(conversationId);
    if (found === null) throw new Error("conversation not found");
    const existing = found.conversation.dshSessionId;
    if (existing !== null) {
      if (this.activeSessions.has(existing)) {
        this.sessionToConversation.set(existing, conversationId);
        this.conversationToSession.set(conversationId, existing);
        return existing;
      }
      try {
        const response = await this.requireConnection().agent.request("session/resume", {
          sessionId: existing,
          cwd: this.sessionCwd,
          mcpServers: [],
        });
        const configOptions = configOptionsFromAcp(response.configOptions);
        if (configOptions.length > 0) {
          this.store.setConfigOptions(conversationId, configOptions);
          this.emit({ type: "config", conversationId, configOptions });
        }
        if (this.target !== "") this.store.setDshTarget(conversationId, this.target);
        this.activeSessions.add(existing);
        this.sessionToConversation.set(existing, conversationId);
        this.conversationToSession.set(conversationId, existing);
        return existing;
      } catch {
        // セッションを再開できない場合は、同じ会話として新しいセッションを作る。
      }
    }
    const response = await this.requireConnection().agent.request("session/new", {
      cwd: this.sessionCwd,
      mcpServers: [],
    });
    const sessionId = response.sessionId;
    const configOptions = configOptionsFromAcp(response.configOptions);
    this.store.setSessionId(conversationId, sessionId);
    this.store.setConfigOptions(conversationId, configOptions);
    if (this.target !== "") this.store.setDshTarget(conversationId, this.target);
    this.activeSessions.add(sessionId);
    this.sessionToConversation.set(sessionId, conversationId);
    this.conversationToSession.set(conversationId, sessionId);
    this.emit({ type: "config", conversationId, configOptions });
    return sessionId;
  }

  async prepare(conversationId: string): Promise<ConfigOption[]> {
    const found = this.store.getConversation(conversationId);
    if (found === null) throw new Error("conversation not found");
    if (this.mode === "mock") {
      this.ensureMockConfig(conversationId);
      return found.conversation.configOptions;
    }
    await this.waitReady();
    await this.ensureSession(conversationId);
    const updated = this.store.getConversation(conversationId);
    return updated?.conversation.configOptions ?? [];
  }

  prompt(conversationId: string, text: string): void {
    if (this.activePrompts.has(conversationId)) {
      throw new Error("prompt already running");
    }
    if (this.mode === "mock") {
      this.runMockPrompt(conversationId, text);
      return;
    }
    void this.runPrompt(conversationId, text);
  }

  private async runPrompt(conversationId: string, text: string): Promise<void> {
    this.activePrompts.add(conversationId);
    this.currentAssistant.delete(conversationId);
    this.toolMessages.set(conversationId, new Map());
    this.emit({ type: "status", conversationId, working: true });
    try {
      await this.waitReady();
      const found = this.store.getConversation(conversationId);
      if (found === null) throw new Error("conversation not found");
      const sessionId = await this.ensureSession(conversationId);
      const userMessage: ChatMessage = {
        id: newId("msg"),
        role: "user",
        content: text,
        status: "done",
        createdAt: new Date().toISOString(),
      };
      this.store.appendMessage(conversationId, userMessage);
      this.emit({ type: "message", conversationId, message: userMessage });
      const response = await this.requireConnection().agent.request("session/prompt", {
        sessionId,
        prompt: [{ type: "text", text }],
      });
      this.finishAssistant(conversationId, response.stopReason === "cancelled" ? "stopped" : "done");
    } catch (error) {
      this.finishAssistant(conversationId, "error");
      this.emit({ type: "error", conversationId, message: this.errorText(error) });
    } finally {
      this.activePrompts.delete(conversationId);
      this.emit({ type: "status", conversationId, working: false });
    }
  }

  cancel(conversationId: string): void {
    if (this.mode === "mock") {
      const timer = this.mockTimers.get(conversationId);
      if (timer !== undefined) {
        clearTimeout(timer);
        this.mockTimers.delete(conversationId);
      }
      this.finishAssistant(conversationId, "stopped");
      this.activePrompts.delete(conversationId);
      this.emit({ type: "status", conversationId, working: false });
      return;
    }
    for (const [requestId, pending] of this.pendingPermissions) {
      if (pending.conversationId !== conversationId) continue;
      this.pendingPermissions.delete(requestId);
      pending.resolve({ outcome: { outcome: "cancelled" } });
    }
    const sessionId = this.conversationToSession.get(conversationId);
    if (sessionId === undefined) return;
    this.requireConnection().agent.notify("session/cancel", { sessionId }).catch(() => undefined);
  }

  async setConfig(conversationId: string, configId: string, value: string): Promise<ConfigOption[]> {
    const found = this.store.getConversation(conversationId);
    if (found === null) throw new Error("conversation not found");
    if (this.mode === "mock") {
      const updated = found.conversation.configOptions.map((option) =>
        option.id === configId ? { ...option, current: value } : option,
      );
      this.store.setConfigOptions(conversationId, updated);
      this.emit({ type: "config", conversationId, configOptions: updated });
      return updated;
    }
    await this.waitReady();
    const sessionId = await this.ensureSession(conversationId);
    const response = await this.requireConnection().agent.request("session/set_config_option", {
      sessionId,
      configId,
      value,
    });
    const options = configOptionsFromAcp(response.configOptions);
    this.store.setConfigOptions(conversationId, options);
    this.emit({ type: "config", conversationId, configOptions: options });
    return options;
  }

  resolvePermission(requestId: string, optionId: string): boolean {
    const pending = this.pendingPermissions.get(requestId);
    if (pending === undefined) return false;
    this.pendingPermissions.delete(requestId);
    pending.resolve({ outcome: { outcome: "selected", optionId } });
    return true;
  }

  cancelPermission(requestId: string): boolean {
    const pending = this.pendingPermissions.get(requestId);
    if (pending === undefined) return false;
    this.pendingPermissions.delete(requestId);
    pending.resolve({ outcome: { outcome: "cancelled" } });
    return true;
  }

  private async handlePermission(
    params: RequestPermissionRequest,
    signal: AbortSignal,
  ): Promise<RequestPermissionResponse> {
    const conversationId = this.sessionToConversation.get(params.sessionId);
    if (conversationId === undefined) return { outcome: { outcome: "cancelled" } };
    const found = this.store.getConversation(conversationId);
    if (found === null) return { outcome: { outcome: "cancelled" } };
    const allow =
      params.options.find((option) => option.kind === "allow_always") ??
      params.options.find((option) => option.kind === "allow_once");
    if (found.conversation.permissionMode === "allow_all" && allow !== undefined) {
      return { outcome: { outcome: "selected", optionId: allow.optionId } };
    }
    const requestId = crypto.randomUUID();
    const options = params.options.map((option) => ({ id: option.optionId, name: option.name }));
    const title = params.toolCall.title ?? "操作の許可";
    this.emit({ type: "permission", conversationId, requestId, title, options });
    return new Promise<RequestPermissionResponse>((resolve) => {
      this.pendingPermissions.set(requestId, { conversationId, resolve });
      signal.addEventListener(
        "abort",
        () => {
          if (this.pendingPermissions.delete(requestId)) {
            resolve({ outcome: { outcome: "cancelled" } });
          }
        },
        { once: true },
      );
    });
  }

  private handleUpdate(notification: SessionNotification): void {
    const conversationId = this.sessionToConversation.get(notification.sessionId);
    if (conversationId === undefined) return;
    const update = notification.update;
    switch (update.sessionUpdate) {
      case "agent_message_chunk": {
        const content = update.content;
        if (content.type !== "text") return;
        const current = this.currentAssistant.get(conversationId);
        if (current === undefined) {
          const message: ChatMessage = {
            id: newId("msg"),
            role: "assistant",
            content: content.text,
            status: "streaming",
            createdAt: new Date().toISOString(),
          };
          this.store.appendMessage(conversationId, message);
          this.currentAssistant.set(conversationId, {
            messageId: message.id,
            content: content.text,
            status: "streaming",
          });
          this.emit({ type: "message", conversationId, message });
          return;
        }
        current.content += content.text;
        this.store.updateMessage(conversationId, current.messageId, { content: current.content });
        this.emit({
          type: "chunk",
          conversationId,
          messageId: current.messageId,
          content: current.content,
          status: current.status,
        });
        return;
      }
      case "tool_call": {
        const messageId = this.toolMessageId(conversationId, update.toolCallId);
        const title = update.title;
        const status = update.status ?? "pending";
        const kind = update.kind ?? "other";
        const content = "Progress: " + title + " (" + kind + " / " + status + ")";
        const existing = this.store.readMessages(conversationId).find((message) => message.id === messageId);
        if (existing === undefined) {
          const message: ChatMessage = {
            id: messageId,
            role: "tool",
            content,
            status: "streaming",
            createdAt: new Date().toISOString(),
          };
          this.store.appendMessage(conversationId, message);
          this.emit({ type: "message", conversationId, message });
        } else {
          this.store.updateMessage(conversationId, messageId, { content });
          this.emit({ type: "chunk", conversationId, messageId, content, status: "streaming" });
        }
        return;
      }
      case "tool_call_update": {
        const messageId = this.toolMessages.get(conversationId)?.get(update.toolCallId);
        if (messageId === undefined) return;
        const existing = this.store.readMessages(conversationId).find((message) => message.id === messageId);
        if (existing === undefined) return;
        const title = update.title ?? existing.content;
        const status = update.status ?? "completed";
        const content = "Progress: " + title + " (" + status + ")";
        const messageStatus: ChatMessage["status"] = status === "failed" ? "error" : "done";
        this.store.updateMessage(conversationId, messageId, { content, status: messageStatus });
        this.emit({ type: "message", conversationId, message: { ...existing, content, status: messageStatus } });
        return;
      }
      case "config_option_update": {
        const options = configOptionsFromAcp(update.configOptions);
        this.store.setConfigOptions(conversationId, options);
        this.emit({ type: "config", conversationId, configOptions: options });
        return;
      }
      default:
        return;
    }
  }

  private toolMessageId(conversationId: string, toolCallId: string): string {
    let messages = this.toolMessages.get(conversationId);
    if (messages === undefined) {
      messages = new Map();
      this.toolMessages.set(conversationId, messages);
    }
    const existing = messages.get(toolCallId);
    if (existing !== undefined) return existing;
    const messageId = "tool-" + conversationId + "-" + toolCallId;
    messages.set(toolCallId, messageId);
    return messageId;
  }

  private finishAssistant(conversationId: string, status: "done" | "stopped" | "error"): void {
    const current = this.currentAssistant.get(conversationId);
    if (current === undefined) return;
    this.currentAssistant.delete(conversationId);
    const message = this.store.updateMessage(conversationId, current.messageId, { status });
    if (message !== null) {
      this.emit({ type: "message", conversationId, message });
    }
  }

  private runMockPrompt(conversationId: string, text: string): void {
    const found = this.store.getConversation(conversationId);
    if (found === null) return;
    this.activePrompts.add(conversationId);
    this.currentAssistant.delete(conversationId);
    this.emit({ type: "status", conversationId, working: true });
    const userMessage: ChatMessage = {
      id: newId("msg"),
      role: "user",
      content: text,
      status: "done",
      createdAt: new Date().toISOString(),
    };
    this.store.appendMessage(conversationId, userMessage);
    this.emit({ type: "message", conversationId, message: userMessage });

    const assistantId = newId("msg");
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      status: "streaming",
      createdAt: new Date().toISOString(),
    };
    this.store.appendMessage(conversationId, assistantMessage);
    this.currentAssistant.set(conversationId, { messageId: assistantId, content: "", status: "streaming" });
    this.emit({ type: "message", conversationId, message: assistantMessage });

    const reply = mockReply(text, found.task);
    const timer = setTimeout(() => {
      this.mockTimers.delete(conversationId);
      const current = this.currentAssistant.get(conversationId);
      if (current === undefined) return;
      current.content = reply;
      this.store.updateMessage(conversationId, current.messageId, { content: reply });
      this.emit({
        type: "chunk",
        conversationId,
        messageId: current.messageId,
        content: reply,
        status: "streaming",
      });
      this.finishAssistant(conversationId, "done");
      this.activePrompts.delete(conversationId);
      this.emit({ type: "status", conversationId, working: false });
    }, 450);
    this.mockTimers.set(conversationId, timer);
    this.ensureMockConfig(conversationId);
  }

  private ensureMockConfig(conversationId: string): void {
    const found = this.store.getConversation(conversationId);
    if (found === null) return;
    if (found.conversation.configOptions.length > 0) return;
    const configOptions: ConfigOption[] = [
      {
        id: "model",
        name: "モデル",
        category: "model",
        values: [
          { value: "siftq-fast", name: "siftq-fast" },
          { value: "siftq-pro", name: "siftq-pro" },
        ],
        current: "siftq-fast",
      },
    ];
    this.store.setConfigOptions(conversationId, configOptions);
    this.emit({ type: "config", conversationId, configOptions });
  }
}

export function isChatMessage(value: unknown): value is ChatMessage {
  return isRecord(value) && typeof value["id"] === "string" && typeof value["content"] === "string";
}

export type DshManagerOptions = {
  mode?: RuntimeMode;
  bin?: string;
  profile?: string;
};


export class DshManager {
  private readonly runtimes = new Map<string, DshRuntime>();
  private readonly options: DshManagerOptions;

  constructor(
    private readonly store: Store,
    private readonly emit: (event: ChatEvent) => void,
    options: DshManagerOptions = {},
  ) {
    this.options = options;
  }

  private runtimeFor(target: string): DshRuntime {
    const existing = this.runtimes.get(target);
    if (existing !== undefined) return existing;
    const cwd =
      target === ""
        ? ""
        : (sandboxWorkspaceForHost(target) ?? process.env["POC_SSH_CWD"] ?? "");
    const runtime = new DshRuntime(this.store, this.emit, {
      ...this.options,
      target: target,
      cwd: cwd,
    });
    this.runtimes.set(target, runtime);
    void runtime.start().catch(() => undefined);
    return runtime;
  }

  private targetFor(conversationId: string): string {
    const found = this.store.getConversation(conversationId);
    if (found === null) throw new Error("conversation not found");
    const groupTarget = this.store.getGroupTarget(found.task.project);
    const stored = found.conversation.dshTarget;
    if (stored !== null && stored !== "" && stored !== groupTarget) {
      this.store.resetConversationDsh(conversationId);
    }
    return groupTarget;
  }

  async start(): Promise<void> {
    this.runtimeFor("");
  }

  async stop(): Promise<void> {
    await Promise.all(Array.from(this.runtimes.values()).map((runtime) => runtime.stop()));
    this.runtimes.clear();
  }

  async retry(target?: string): Promise<DshStatusEntry[]> {
    if (target === undefined) {
      await Promise.all(Array.from(this.runtimes.values()).map((runtime) => runtime.retry()));
      return this.getStatuses();
    }
    const runtime = this.runtimes.get(target);
    if (runtime === undefined) {
      this.runtimeFor(target);
      return this.getStatuses();
    }
    await runtime.retry();
    return this.getStatuses();
  }

  getStatuses(): DshStatusEntry[] {
    return Array.from(this.runtimes.entries()).map(([target, runtime]) => ({
      target,
      status: runtime.getStatus(),
    }));
  }

  isBusy(conversationId: string): boolean {
    try {
      return this.runtimeFor(this.targetFor(conversationId)).isBusy(conversationId);
    } catch {
      return false;
    }
  }

  async prepare(conversationId: string): Promise<ConfigOption[]> {
    const target = this.targetFor(conversationId);
    if (target !== "") this.store.setDshTarget(conversationId, target);
    return this.runtimeFor(target).prepare(conversationId);
  }

  prompt(conversationId: string, text: string): void {
    const target = this.targetFor(conversationId);
    if (target !== "") this.store.setDshTarget(conversationId, target);
    this.runtimeFor(target).prompt(conversationId, text);
  }

  cancel(conversationId: string): void {
    try {
      this.runtimeFor(this.targetFor(conversationId)).cancel(conversationId);
    } catch {
      // unknown conversation
    }
  }

  async setConfig(conversationId: string, configId: string, value: string): Promise<ConfigOption[]> {
    const target = this.targetFor(conversationId);
    if (target !== "") this.store.setDshTarget(conversationId, target);
    return this.runtimeFor(target).setConfig(conversationId, configId, value);
  }

  resolvePermission(requestId: string, optionId: string): boolean {
    for (const runtime of this.runtimes.values()) {
      if (runtime.resolvePermission(requestId, optionId)) return true;
    }
    return false;
  }

  cancelPermission(requestId: string): boolean {
    for (const runtime of this.runtimes.values()) {
      if (runtime.cancelPermission(requestId)) return true;
    }
    return false;
  }
}
