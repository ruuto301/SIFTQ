import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import { DshManager } from "./acp";
import { Store, StoreError, normalizeState } from "./store";
import { readSshHosts } from "./ssh";
import type { ChatEvent } from "./types";

const PORT = Number(process.env["POC_PORT"] ?? 8099);
const PUBLIC_DIR = join(import.meta.dir, "..", "public");
const MODE = process.env["POC_DSH"] === "mock" ? "mock" : "real";
const encoder = new TextEncoder();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const store = new Store();
const subscribers = new Set<(event: ChatEvent) => void>();
const runtime = new DshManager(store, (event) => {
  for (const send of subscribers) send(event);
}, { mode: MODE });

const app = new Hono();

app.get("/api/health", (c) => c.json(runtime.getStatuses()));

app.get("/api/ssh-hosts", (c) => c.json(readSshHosts()));

app.get("/api/state", (c) => c.json({ state: store.getPayload(), dsh: runtime.getStatuses() }));

app.put("/api/state", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (body === null) return c.json({ error: "invalid state" }, 400);
  try {
    const state = store.save(normalizeState(body));
    return c.json({ state, dsh: runtime.getStatuses() });
  } catch (error) {
    if (error instanceof StoreError) {
      return c.json({ error: error.message, group: error.group }, 400);
    }
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

app.post("/api/conversations/:id/prepare", async (c) => {
  try {
    const configOptions = await runtime.prepare(c.req.param("id"));
    return c.json({ configOptions });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 503);
  }
});

app.post("/api/conversations/:id/prompt", async (c) => {
  const conversationId = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const text = isRecord(body) && typeof body["text"] === "string" ? body["text"].trim() : "";
  if (text === "") return c.json({ error: "text is required" }, 400);
  if (runtime.isBusy(conversationId)) return c.json({ error: "prompt already running" }, 409);
  try {
    runtime.prompt(conversationId, text);
    return c.json({ ok: true }, 202);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

app.post("/api/conversations/:id/cancel", (c) => {
  runtime.cancel(c.req.param("id"));
  return c.json({ ok: true });
});

app.post("/api/conversations/:id/config", async (c) => {
  const conversationId = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  if (!isRecord(body)) return c.json({ error: "invalid config" }, 400);
  const configId = typeof body["configId"] === "string" ? body["configId"] : "";
  const value = typeof body["value"] === "string" ? body["value"] : "";
  if (configId === "" || value === "") return c.json({ error: "configId and value are required" }, 400);
  try {
    const configOptions = await runtime.setConfig(conversationId, configId, value);
    return c.json({ configOptions });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

app.patch("/api/conversations/:id", async (c) => {
  const conversationId = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  if (!isRecord(body)) return c.json({ error: "invalid body" }, 400);
  const mode = body["permissionMode"];
  if (mode !== "ask" && mode !== "allow_all") return c.json({ error: "invalid permissionMode" }, 400);
  const found = store.getConversation(conversationId);
  if (found === null) return c.json({ error: "conversation not found" }, 404);
  store.setPermissionMode(conversationId, mode);
  return c.json({ ok: true });
});

app.post("/api/permissions/:id", async (c) => {
  const requestId = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  if (!isRecord(body)) return c.json({ error: "invalid body" }, 400);
  if (body["cancelled"] === true) {
    return runtime.cancelPermission(requestId) ? c.json({ ok: true }) : c.json({ error: "unknown request" }, 404);
  }
  const optionId = typeof body["optionId"] === "string" ? body["optionId"] : "";
  if (optionId === "") return c.json({ error: "optionId is required" }, 400);
  return runtime.resolvePermission(requestId, optionId)
    ? c.json({ ok: true })
    : c.json({ error: "unknown request" }, 404);
});

app.post("/api/dsh/retry", async (c) => {
  const body = await c.req.json().catch(() => null);
  const target = isRecord(body) && typeof body["target"] === "string" ? body["target"] : undefined;
  return c.json(await runtime.retry(target));
});

app.get("/api/events", (c) => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: ChatEvent): void => {
        try {
          controller.enqueue(encoder.encode("data: " + JSON.stringify(event) + "\n\n"));
        } catch {
          subscribers.delete(send);
        }
      };
      subscribers.add(send);
      for (const entry of runtime.getStatuses()) {
        send({ type: "dsh", target: entry.target, status: entry.status });
      }
      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          subscribers.delete(send);
          clearInterval(ping);
        }
      }, 5000);
      c.req.raw.signal.addEventListener(
        "abort",
        () => {
          clearInterval(ping);
          subscribers.delete(send);
          try {
            controller.close();
          } catch {
            // already closed
          }
        },
        { once: true },
      );
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  });
});

const NO_STORE = { "cache-control": "no-store" } as const;

app.get("/", (c) => c.html(readFileSync(join(PUBLIC_DIR, "index.html"), "utf8"), 200, NO_STORE));
app.get("/app.js", (c) =>
  c.body(readFileSync(join(PUBLIC_DIR, "app.js"), "utf8"), 200, {
    "content-type": "application/javascript; charset=utf-8",
    ...NO_STORE,
  }),
);
app.get("/styles.css", (c) =>
  c.body(readFileSync(join(PUBLIC_DIR, "styles.css"), "utf8"), 200, {
    "content-type": "text/css; charset=utf-8",
    ...NO_STORE,
  }),
);

void runtime.start();

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: PORT,
  idleTimeout: 120,
  fetch: app.fetch,
});

console.log("siftq poc: http://127.0.0.1:" + server.port);

process.on("SIGINT", () => {
  void runtime.stop();
  server.stop();
  process.exit(0);
});
process.on("SIGTERM", () => {
  void runtime.stop();
  server.stop();
  process.exit(0);
});
