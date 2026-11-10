import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import { readContext, writeContext } from "./context";
import { DshWebManager } from "./dsh-web";
import { sandboxWorkspaceForHost, readSandboxes } from "./sandboxes";
import { readSshHosts } from "./ssh";
import { Store, StoreError, normalizeState } from "./store";
import type { ChatEvent } from "./types";

const PORT = Number(process.env["POC_PORT"] ?? 8099);
const PUBLIC_DIR = join(import.meta.dir, "..", "public");
const encoder = new TextEncoder();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const store = new Store();
const subscribers = new Set<(event: ChatEvent) => void>();
const runtime = new DshWebManager(store, (event) => {
  for (const send of subscribers) send(event);
});

const app = new Hono();

function resolveCwd(target: string): string {
  console.log("resolveCwd start", target);
  if (target === "") return process.cwd();
  const workspace = sandboxWorkspaceForHost(target);
  if (workspace !== null) {
    console.log("resolveCwd workspace", workspace);
    return workspace;
  }
  const configured = process.env["POC_SSH_CWD"];
  if (configured !== undefined && configured !== "") return configured;
  const sshBin = process.env["POC_SSH_BIN"] ?? "ssh";
  const probe = spawnSync(sshBin, [target, "pwd"], { encoding: "utf8", windowsHide: true });
  if (probe.error) throw probe.error;
  if (probe.status !== 0) throw new Error(probe.stderr.trim() || "ssh " + target + " failed");
  console.log("resolveCwd probe", probe.stdout.trim());
  return probe.stdout.trim();
}

app.get("/api/health", (c) => c.json(runtime.getStatuses()));

app.get("/api/sandboxes", (c) => c.json(readSandboxes()));

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

app.get("/api/conversations/:id/ui-url", async (c) => {
  try {
    const url = await runtime.getUiUrl(c.req.param("id"));
    return c.json({ url });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 503);
  }
});

app.post("/api/dsh-web/retry", async (c) => {
  const body = await c.req.json().catch(() => null);
  const target = isRecord(body) && typeof body["target"] === "string" ? body["target"] : undefined;
  return c.json(await runtime.retry(target));
});

app.get("/api/context/:id", async (c) => {
  const found = store.getConversation(c.req.param("id"));
  if (found === null) return c.json({ error: "conversation not found" }, 404);
  const target = store.getGroupTarget(found.task.project);
  try {
    const cwd = resolveCwd(target);
    return c.json(await readContext(target, cwd));
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

app.put("/api/context/:id", async (c) => {
  const found = store.getConversation(c.req.param("id"));
  if (found === null) return c.json({ error: "conversation not found" }, 404);
  const body = await c.req.json().catch(() => null);
  if (!isRecord(body)) return c.json({ error: "invalid body" }, 400);
  const data = {
    memo: typeof body["memo"] === "string" ? body["memo"] : "",
    browserUrl: typeof body["browserUrl"] === "string" ? body["browserUrl"] : "",
    browserTitle: typeof body["browserTitle"] === "string" ? body["browserTitle"] : "",
  };
  const target = store.getGroupTarget(found.task.project);
  try {
    const cwd = resolveCwd(target);
    await writeContext(target, cwd, found.task.title, data);
    return c.json({ ok: true });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
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

void runtime.start().catch(() => undefined);

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
