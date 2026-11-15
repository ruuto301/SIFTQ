import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../server/store";
import type { Task } from "../server/types";

const temporaryDirectories: string[] = [];

function temporaryStore(): { store: Store; directory: string } {
  const directory = mkdtempSync(join(tmpdir(), "siftq-poc-test-"));
  temporaryDirectories.push(directory);
  return { store: new Store(directory), directory };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("Store", () => {
  it("loads the seed groups, tasks, and chat history", () => {
    const { store } = temporaryStore();
    const payload = store.getPayload();
    const conversationId = payload.tasks[0]?.conversations[0]?.id;

    expect(payload.groups.map((group) => group.name)).toContain("Yoriwake");
    expect(payload.groups.map((group) => group.name)).toContain("その他");
    expect(payload.tasks.length).toBeGreaterThan(0);
    expect(conversationId).toBeDefined();
    if (conversationId !== undefined) {
      expect(store.readMessages(conversationId).length).toBeGreaterThan(0);
    }
  });

  it("persists group and task changes across reloads", () => {
    const { store, directory } = temporaryStore();
    const payload = store.getPayload();
    const now = new Date().toISOString();
    const task: Task = {
      id: "task-test",
      kind: "task",
      title: "テストタスク",
      project: "TestGroup",
      status: "do",
      working: false,
      pinned: false,
      unread: false,
      source: "manual",
      order: 0,
      createdAt: now,
      updatedAt: now,
      memo: "メモ",
      conversations: [
        {
          id: "conv-test",
          title: "メイン",
          dshSessionId: null,
          dshTarget: null,
          permissionMode: "ask",
          configOptions: [],
          messages: [],
        },
      ],
      browserTabs: [{ id: "tab-test", url: "about:blank", title: "新しいタブ", active: true }],
      ui: { centerTab: "chat", selectedConversationId: "conv-test" },
    };
    payload.tasks.push(task);
    payload.groups.push({ name: "TestGroup", target: "" });
    payload.projectOrder.push("TestGroup");
    store.save(payload);

    const reloaded = new Store(directory).getPayload();
    expect(reloaded.tasks.some((item) => item.id === "task-test")).toBe(true);
    expect(reloaded.groups.some((group) => group.name === "TestGroup")).toBe(true);
    expect(reloaded.tasks.find((item) => item.id === "task-test")?.memo).toBe("メモ");
  });

  it("persists a target without local path validation", () => {
    const { store } = temporaryStore();
    const payload = store.getPayload();
    payload.groups.push({ name: "TestGroup", target: "test-host" });

    const saved = store.save(payload);
    expect(saved.groups.some((group) => group.target === "test-host")).toBe(true);
  });

  it("appends and updates chat messages", () => {
    const { store } = temporaryStore();
    const conversationId = store.getPayload().tasks[0]?.conversations[0]?.id;
    expect(conversationId).toBeDefined();
    if (conversationId === undefined) return;

    const before = store.readMessages(conversationId).length;
    store.appendMessage(conversationId, {
      id: "msg-test",
      role: "user",
      content: "hello",
      status: "done",
      createdAt: new Date().toISOString(),
    });
    expect(store.readMessages(conversationId).length).toBe(before + 1);

    store.updateMessage(conversationId, "msg-test", { content: "updated" });
    expect(store.readMessages(conversationId).find((message) => message.id === "msg-test")?.content).toBe("updated");
  });

  it("resets conversation DSH state when the group target changes", () => {
    const { store } = temporaryStore();
    const payload = store.getPayload();
    const group = payload.groups.find((item) => item.name === "Yoriwake");
    const task = payload.tasks.find((item) => item.project === "Yoriwake");
    const conversation = task?.conversations[0];
    expect(group).toBeDefined();
    expect(conversation).toBeDefined();
    if (!group || !task || !conversation) return;

    group.target = "yoriwake.sbx";
    store.save(payload);
    store.setDshTarget(conversation.id, "yoriwake.sbx");
    store.setSessionId(conversation.id, "session-1");
    store.setConfigOptions(conversation.id, [
      { id: "model", name: "モデル", values: [{ value: "a", name: "A" }], current: "a" },
    ]);

    const before = store.getConversation(conversation.id)?.conversation;
    expect(before?.dshTarget).toBe("yoriwake.sbx");
    expect(before?.dshSessionId).toBe("session-1");
    expect(before?.configOptions.length).toBe(1);

    const next = store.getPayload();
    const nextGroup = next.groups.find((item) => item.name === "Yoriwake");
    if (!nextGroup) return;
    nextGroup.target = "affiliate.sbx";
    store.save(next);

    const after = store.getConversation(conversation.id)?.conversation;
    expect(after?.dshTarget).toBeNull();
    expect(after?.dshSessionId).toBeNull();
    expect(after?.configOptions).toEqual([]);
    expect(after?.messages.length).toBeGreaterThan(0);
  });

  it("keeps DSH state when the target is unchanged and falls back from an empty target", () => {
    const { store } = temporaryStore();
    const payload = store.getPayload();
    const group = payload.groups.find((item) => item.name === "Yoriwake");
    const task = payload.tasks.find((item) => item.project === "Yoriwake");
    const conversation = task?.conversations[0];
    if (!group || !task || !conversation) return;

    group.target = "yoriwake.sbx";
    store.save(payload);
    store.setDshTarget(conversation.id, "yoriwake.sbx");
    store.setSessionId(conversation.id, "session-1");
    store.setConfigOptions(conversation.id, [
      { id: "model", name: "モデル", values: [{ value: "a", name: "A" }], current: "a" },
    ]);

    store.save(store.getPayload());
    const kept = store.getConversation(conversation.id)?.conversation;
    expect(kept?.dshTarget).toBe("yoriwake.sbx");
    expect(kept?.dshSessionId).toBe("session-1");
    expect(kept?.configOptions.length).toBe(1);

    store.setDshTarget(conversation.id, "");
    expect(store.getConversationTarget(conversation.id)).toBe("yoriwake.sbx");
  });
});
