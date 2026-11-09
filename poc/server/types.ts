export type TaskKind = "task" | "tentative";
export type TaskStatus = "do" | "done" | "skip";
export type CenterTab = "chat" | "memo";
export type PermissionMode = "ask" | "allow_all";

export type Group = {
  name: string;
  target: string;
};

export type BrowserTab = {
  id: string;
  url: string;
  title: string;
  active: boolean;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  status: "streaming" | "done" | "stopped" | "error";
  createdAt: string;
};

export type ConfigOptionValue = {
  value: string;
  name: string;
};

export type ConfigOption = {
  id: string;
  name: string;
  category?: string;
  values: ConfigOptionValue[];
  current: string;
};

export type Conversation = {
  id: string;
  title: string;
  dshSessionId: string | null;
  dshTarget: string | null;
  permissionMode: PermissionMode;
  configOptions: ConfigOption[];
  messages: ChatMessage[];
};

export type Task = {
  id: string;
  kind: TaskKind;
  title: string;
  project: string;
  status: TaskStatus;
  working: boolean;
  pinned: boolean;
  unread: boolean;
  source: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  memo: string;
  conversations: Conversation[];
  browserTabs: BrowserTab[];
  ui: {
    centerTab: CenterTab;
    selectedConversationId: string | null;
  };
};

export type PersistedState = {
  version: 1;
  statusFilter: TaskStatus;
  selectedTaskId: string | null;
  paneWidths: { left: number; right: number };
  collapsed: Record<string, boolean>;
  tasks: Task[];
};

export type StatePayload = PersistedState & {
  groups: Group[];
  projectOrder: string[];
};

export type GroupsFile = {
  groups: Group[];
};

export type DshStatus = {
  state: "starting" | "ready" | "error" | "mock" | "stopped";
  profile: string;
  target: string;
  error?: string;
};

export type DshStatusEntry = {
  target: string;
  status: DshStatus;
};

export type ServerStatePayload = {
  state: StatePayload;
  dsh: DshStatusEntry[];
};

export type ChatEvent =
  | { type: "message"; conversationId: string; message: ChatMessage }
  | { type: "chunk"; conversationId: string; messageId: string; content: string; status: ChatMessage["status"] }
  | { type: "status"; conversationId: string; working: boolean }
  | { type: "config"; conversationId: string; configOptions: ConfigOption[] }
  | { type: "permission"; conversationId: string; requestId: string; title: string; options: { id: string; name: string }[] }
  | { type: "dsh"; target: string; status: DshStatus }
  | { type: "error"; conversationId?: string; message: string };
