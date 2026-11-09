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
    payload.groups.push({ name: "TestGroup", target: "ssh:test-host" });

    const saved = store.save(payload);
    expect(saved.groups.some((group) => group.target === "ssh:test-host")).toBe(true);
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
});
