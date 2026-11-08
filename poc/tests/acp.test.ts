import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DshRuntime } from "../server/acp";
import { Store } from "../server/store";
import type { ChatEvent } from "../server/types";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

async function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("timed out");
}

describe("DshRuntime mock mode", () => {
  it("creates a chat reply and emits user and assistant messages", async () => {
    const directory = mkdtempSync(join(tmpdir(), "siftq-poc-acp-"));
    temporaryDirectories.push(directory);
    const store = new Store(directory);
    const events: ChatEvent[] = [];
    const runtime = new DshRuntime(store, (event) => events.push(event), { mode: "mock" });
    await runtime.start();

    expect(runtime.getStatus().state).toBe("mock");
    const task = store.getPayload().tasks.find((item) => item.id === "task-github");
    const conversationId = task?.conversations[0]?.id;
    expect(conversationId).toBeDefined();
    if (conversationId === undefined) return;

    runtime.prompt(conversationId, "メモを確認して");
    await waitFor(() =>
      events.some(
        (event) =>
          event.type === "message" &&
          event.message.role === "assistant" &&
          event.message.content.includes("メモを確認しました"),
      ),
    );

    expect(
      events.some((event) => event.type === "message" && event.message.role === "user"),
    ).toBe(true);
    expect(
      events.some(
        (event) =>
          event.type === "message" &&
          event.message.role === "assistant" &&
          event.message.status === "done",
      ),
    ).toBe(true);
    expect(runtime.isBusy(conversationId)).toBe(false);

    await runtime.stop();
  });
});
