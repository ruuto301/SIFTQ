import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { configOptionsFromAcp } from "./config";
import { createSeedState } from "./seed";
import type {
  BrowserTab,
  ChatMessage,
  ConfigOption,
  Conversation,
  Group,
  PersistedState,
  StatePayload,
  Task,
  TaskKind,
  TaskStatus,
} from "./types";

const APP_ROOT = join(import.meta.dir, "..");
export const DATA_DIR = process.env["POC_DATA_DIR"]
  ? resolve(process.env["POC_DATA_DIR"])
  : join(APP_ROOT, "data");

export class StoreError extends Error {
  readonly group: string | null;

  constructor(message: string, group: string | null = null) {
    super(message);
    this.name = "StoreError";
    this.group = group;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return value === "do" || value === "done" || value === "skip";
}

function isTaskKind(value: unknown): value is TaskKind {
  return value === "task" || value === "tentative";
}

function isPermissionMode(value: unknown): value is "ask" | "allow_all" {
  return value === "ask" || value === "allow_all";
}

function normalizeTarget(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "") return "";
  if (trimmed.startsWith("ssh:")) return trimmed.slice(4).trim();
  if (trimmed.startsWith("/") || /^[A-Za-z]:[\\/]/.test(trimmed)) return "";
  return trimmed;
}

function normalizeConversationTarget(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const trimmed = value.trim();
  if (trimmed.startsWith("ssh:")) return trimmed.slice(4).trim();
  if (trimmed.startsWith("/") || /^[A-Za-z]:[\\/]/.test(trimmed)) return null;
  return trimmed;
}

function readJson(path: string): unknown {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const temp = path + "." + process.pid + "." + Date.now() + ".tmp";
  writeFileSync(temp, JSON.stringify(value, null, 2) + "\n", "utf8");
  renameSync(temp, path);
}

function normalizeUiConfigOptions(value: unknown): ConfigOption[] {
  if (!Array.isArray(value)) return [];
  const result: ConfigOption[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const id = stringValue(item["id"]);
    if (id === "") continue;
    const valuesRaw = item["values"];
    if (!Array.isArray(valuesRaw)) continue;
    const values = valuesRaw.flatMap((entry) => {
      if (!isRecord(entry)) return [];
      const optionValue = entry["value"];
      const optionName = entry["name"];
      if (typeof optionValue !== "string" || typeof optionName !== "string") return [];
      return [{ value: optionValue, name: optionName }];
    });
    if (values.length === 0) continue;
    const option: ConfigOption = {
      id,
      name: stringValue(item["name"], id),
      values,
      current: stringValue(item["current"], values[0]?.value ?? ""),
    };
    const category = item["category"];
    if (typeof category === "string" && category !== "") option.category = category;
    result.push(option);
  }
  return result;
}

function normalizeConfigOptions(value: unknown): ConfigOption[] {
  const direct = normalizeUiConfigOptions(value);
  return direct.length > 0 ? direct : configOptionsFromAcp(value);
}

function normalizeBrowserTab(value: unknown, index: number): BrowserTab | null {
  if (!isRecord(value)) return null;
  return {
    id: stringValue(value["id"], "tab-" + index),
    url: stringValue(value["url"], "about:blank"),
    title: stringValue(value["title"], "新しいタブ"),
    active: booleanValue(value["active"], index === 0),
  };
}

function normalizeBrowserTabs(value: unknown): BrowserTab[] {
  const tabs = Array.isArray(value)
    ? value.flatMap((item, index) => {
        const tab = normalizeBrowserTab(item, index);
        return tab === null ? [] : [tab];
      })
    : [];
  if (tabs.length === 0) {
    return [{ id: "tab-default", url: "about:blank", title: "新しいタブ", active: true }];
  }
  if (!tabs.some((tab) => tab.active)) {
    const first = tabs[0];
    if (first !== undefined) first.active = true;
  }
  return tabs;
}

function normalizeConversation(value: unknown, taskId: string, index: number): Conversation {
  const source = isRecord(value) ? value : {};
  const id = stringValue(source["id"], "conv-" + taskId + "-" + index);
  const dshSessionIdRaw = source["dshSessionId"];
  const dshSessionId = typeof dshSessionIdRaw === "string" && dshSessionIdRaw !== "" ? dshSessionIdRaw : null;
  const dshTarget = normalizeConversationTarget(source["dshTarget"] ?? source["dshWorkspace"]);
  const permissionMode = isPermissionMode(source["permissionMode"]) ? source["permissionMode"] : "ask";
  const messagesRaw = Array.isArray(source["messages"]) ? source["messages"] : [];
  const messages = messagesRaw.flatMap((item, messageIndex) => {
    const message = normalizeMessage(item, messageIndex);
    return message === null ? [] : [message];
  });
  return {
    id,
    title: stringValue(source["title"], index === 0 ? "メイン" : "会話 " + (index + 1)),
    dshSessionId,
    dshTarget,
    permissionMode,
    configOptions: normalizeConfigOptions(source["configOptions"]),
    messages,
  };
}

function normalizeTask(value: unknown, index: number): Task | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value["id"]);
  if (id === "") return null;
  const conversationsRaw = Array.isArray(value["conversations"]) ? value["conversations"] : [];
  const conversations = conversationsRaw.map((item, conversationIndex) =>
    normalizeConversation(item, id, conversationIndex),
  );
  if (conversations.length === 0) {
    conversations.push(normalizeConversation(null, id, 0));
  }
  const ui = isRecord(value["ui"]) ? value["ui"] : {};
  const centerTab = ui["centerTab"] === "memo" ? "memo" : "chat";
  const selectedConversationId = stringValue(ui["selectedConversationId"], conversations[0]?.id ?? "");
  const now = new Date().toISOString();
  return {
    id,
    kind: isTaskKind(value["kind"]) ? value["kind"] : "task",
    title: stringValue(value["title"], "無題"),
    project: stringValue(value["project"], "その他") || "その他",
    status: isTaskStatus(value["status"]) ? value["status"] : "do",
    working: booleanValue(value["working"], false),
    pinned: booleanValue(value["pinned"], false),
    unread: booleanValue(value["unread"], false),
    source: stringValue(value["source"], "manual"),
    order: numberValue(value["order"], index),
    createdAt: stringValue(value["createdAt"], now),
    updatedAt: stringValue(value["updatedAt"], now),
    memo: stringValue(value["memo"], ""),
    conversations,
    browserTabs: normalizeBrowserTabs(value["browserTabs"]),
    ui: {
      centerTab,
      selectedConversationId: conversations.some((conversation) => conversation.id === selectedConversationId)
        ? selectedConversationId
        : (conversations[0]?.id ?? null),
    },
  };
}

function normalizeGroups(
  rawGroups: unknown,
  fallbackGroups: readonly Group[],
  tasks: readonly Task[],
): { groups: Group[]; projectOrder: string[] } {
  const rawList = Array.isArray(rawGroups) ? rawGroups : [];
  const groups: Group[] = [];
  const seen = new Set<string>();
  const add = (name: string, target: string): void => {
    if (name === "" || seen.has(name)) return;
    seen.add(name);
    groups.push({ name, target });
  };
  for (const item of rawList) {
    if (!isRecord(item)) continue;
    const legacyWorkspace = stringValue(item["workspace"]);
    add(stringValue(item["name"]), normalizeTarget(stringValue(item["target"], legacyWorkspace)));
  }
  if (groups.length === 0) {
    for (const group of fallbackGroups) add(group.name, group.target);
  }
  for (const task of tasks) add(task.project, "");
  add("その他", "");
  return {
    groups,
    projectOrder: groups.map((group) => group.name),
  };
}

function normalizeCollapsed(value: unknown): Record<string, boolean> {
  if (!isRecord(value)) return {};
  const result: Record<string, boolean> = {};
  for (const [key, collapsed] of Object.entries(value)) {
    if (collapsed === true) result[key] = true;
  }
  return result;
}

export function normalizeState(value: unknown): StatePayload {
  const seed = createSeedState();
  const source: Record<string, unknown> = isRecord(value) ? value : { ...seed };
  const tasksRaw = Array.isArray(source["tasks"]) ? source["tasks"] : [];
  const tasks = tasksRaw.flatMap((item, index) => {
    const task = normalizeTask(item, index);
    return task === null ? [] : [task];
  });
  const paneWidthsRaw = isRecord(source["paneWidths"]) ? source["paneWidths"] : {};
  const paneWidths = {
    left: numberValue(paneWidthsRaw["left"], 300),
    right: numberValue(paneWidthsRaw["right"], 400),
  };
  const selectedTaskIdRaw = source["selectedTaskId"];
  const selectedTaskId =
    typeof selectedTaskIdRaw === "string" && tasks.some((task) => task.id === selectedTaskIdRaw)
      ? selectedTaskIdRaw
      : (tasks[0]?.id ?? null);
  const { groups, projectOrder } = normalizeGroups(source["groups"], seed.groups, tasks);
  return {
    version: 1,
    statusFilter: isTaskStatus(source["statusFilter"]) ? source["statusFilter"] : "do",
    selectedTaskId,
    paneWidths,
    collapsed: normalizeCollapsed(source["collapsed"]),
    tasks,
    groups,
    projectOrder,
  };
}

function stripMessages(task: Task): Task {
  return {
    ...task,
    conversations: task.conversations.map((conversation) => ({ ...conversation, messages: [] })),
  };
}

function safeConversationId(conversationId: string): string {
  return conversationId.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function normalizeMessage(value: unknown, index: number): ChatMessage | null {
  if (!isRecord(value)) return null;
  const role = value["role"];
  if (role !== "user" && role !== "assistant" && role !== "tool") return null;
  const status = value["status"];
  return {
    id: stringValue(value["id"], "msg-" + index),
    role,
    content: stringValue(value["content"]),
    status: status === "streaming" || status === "stopped" || status === "error" ? status : "done",
    createdAt: stringValue(value["createdAt"], new Date().toISOString()),
  };
}

export class Store {
  private state: StatePayload;
  private readonly chatDir: string;
  private readonly groupsFile: string;
  private readonly stateFile: string;

  constructor(dataDir: string = DATA_DIR) {
    this.chatDir = join(dataDir, "chats");
    this.groupsFile = join(dataDir, "groups.json");
    this.stateFile = join(dataDir, "state.json");
    mkdirSync(this.chatDir, { recursive: true });
    this.state = this.load();
    this.persistCurrent();
  }

  private load(): StatePayload {
    const seed = createSeedState();
    const stateRaw = readJson(this.stateFile);
    const groupsRaw = readJson(this.groupsFile);
    const state = normalizeState(stateRaw ?? seed);
    const groupList = isRecord(groupsRaw) ? groupsRaw["groups"] : null;
    const normalized = normalizeGroups(groupList, state.groups, state.tasks);
    state.groups = normalized.groups;
    state.projectOrder = normalized.projectOrder;
    for (const task of state.tasks) {
      for (const conversation of task.conversations) {
        const stored = this.readMessages(conversation.id);
        if (stored.length === 0 && conversation.messages.length > 0) {
          this.writeMessages(conversation.id, conversation.messages);
        } else {
          conversation.messages = stored;
        }
      }
    }
    return state;
  }

  private persistCurrent(): void {
    const persisted: PersistedState = {
      version: 1,
      statusFilter: this.state.statusFilter,
      selectedTaskId: this.state.selectedTaskId,
      paneWidths: this.state.paneWidths,
      collapsed: this.state.collapsed,
      tasks: this.state.tasks.map(stripMessages),
    };
    writeJson(this.stateFile, persisted);
    writeJson(this.groupsFile, { groups: this.state.groups });
  }

  getPayload(): StatePayload {
    return structuredClone(this.state);
  }

  save(payload: StatePayload): StatePayload {
    const normalized = normalizeState(payload);
    const groups = normalizeGroups(payload.groups, normalized.groups, normalized.tasks);
    normalized.groups = groups.groups;
    normalized.projectOrder = groups.projectOrder;
    const previous = new Map<string, Conversation>();
    for (const task of this.state.tasks) {
      for (const conversation of task.conversations) previous.set(conversation.id, conversation);
    }
    for (const task of normalized.tasks) {
      for (const conversation of task.conversations) {
        const old = previous.get(conversation.id);
        if (old !== undefined) {
          conversation.dshSessionId = old.dshSessionId;
          conversation.dshTarget = old.dshTarget;
          conversation.configOptions = old.configOptions;
        }
        conversation.messages = this.readMessages(conversation.id);
      }
    }
    this.state = normalized;
    this.persistCurrent();
    return this.getPayload();
  }

  getConversation(conversationId: string): { task: Task; conversation: Conversation } | null {
    for (const task of this.state.tasks) {
      const conversation = task.conversations.find((item) => item.id === conversationId);
      if (conversation !== undefined) return { task, conversation };
    }
    return null;
  }

  getGroupTarget(project: string): string {
    const group = this.state.groups.find((item) => item.name === project);
    return group?.target.trim() ?? "";
  }

  getConversationTarget(conversationId: string): string {
    const found = this.getConversation(conversationId);
    if (found === null) return "";
    return found.conversation.dshTarget ?? this.getGroupTarget(found.task.project);
  }

  setDshTarget(conversationId: string, target: string): void {
    const found = this.getConversation(conversationId);
    if (found === null) return;
    found.conversation.dshTarget = target;
    this.persistCurrent();
  }

  readMessages(conversationId: string): ChatMessage[] {
    const path = join(this.chatDir, safeConversationId(conversationId) + ".json");
    const raw = readJson(path);
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((item, index) => {
      const message = normalizeMessage(item, index);
      return message === null ? [] : [message];
    });
  }

  private writeMessages(conversationId: string, messages: readonly ChatMessage[]): void {
    writeJson(join(this.chatDir, safeConversationId(conversationId) + ".json"), messages);
  }

  appendMessage(conversationId: string, message: ChatMessage): ChatMessage {
    const messages = this.readMessages(conversationId);
    messages.push(message);
    this.writeMessages(conversationId, messages);
    const found = this.getConversation(conversationId);
    if (found !== null) found.conversation.messages = messages;
    return message;
  }

  updateMessage(conversationId: string, messageId: string, patch: Partial<ChatMessage>): ChatMessage | null {
    const messages = this.readMessages(conversationId);
    const index = messages.findIndex((message) => message.id === messageId);
    const current = messages[index];
    if (current === undefined) return null;
    const updated: ChatMessage = { ...current, ...patch, id: current.id };
    messages[index] = updated;
    this.writeMessages(conversationId, messages);
    const found = this.getConversation(conversationId);
    if (found !== null) found.conversation.messages = messages;
    return updated;
  }

  setSessionId(conversationId: string, sessionId: string): void {
    const found = this.getConversation(conversationId);
    if (found === null) return;
    found.conversation.dshSessionId = sessionId;
    this.persistCurrent();
  }

  setConfigOptions(conversationId: string, options: ConfigOption[]): void {
    const found = this.getConversation(conversationId);
    if (found === null) return;
    found.conversation.configOptions = options;
    this.persistCurrent();
  }

  setPermissionMode(conversationId: string, mode: "ask" | "allow_all"): void {
    const found = this.getConversation(conversationId);
    if (found === null) return;
    found.conversation.permissionMode = mode;
    this.persistCurrent();
  }

  setMessages(conversationId: string, messages: readonly ChatMessage[]): void {
    this.writeMessages(conversationId, messages);
    const found = this.getConversation(conversationId);
    if (found !== null) found.conversation.messages = [...messages];
  }
}
