import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { test as setup } from "@playwright/test";
import { SESSION_COOKIE_NAME, SESSION_DURATION_MS, createSession } from "../../src/auth";

const authStatePath = fileURLToPath(new URL("../../tmp/smoke-prod/auth.json", import.meta.url));

// Mint a signed session with the same format the Worker uses, so the smoke
// authenticates without going through GitHub OAuth and without adding any
// bypass to the application.
setup("mint a signed session", async () => {
  const secret = process.env["SMOKE_SESSION_SECRET"];
  if (secret === undefined || secret === "") {
    throw new Error("SMOKE_SESSION_SECRET is required to run the production smoke");
  }
  const baseURL = process.env["SMOKE_BASE_URL"] ?? "https://app.siftq-app.workers.dev";
  const target = new URL(baseURL);
  const host = target.hostname;
  const secure = target.protocol === "https:";
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const value = await createSession(secret, expiresAt);

  const state = {
    cookies: [
      {
        name: SESSION_COOKIE_NAME,
        value,
        domain: host,
        path: "/",
        expires: Math.floor(expiresAt / 1000),
        httpOnly: true,
        secure,
        sameSite: "Lax" as const,
      },
    ],
    origins: [],
  };

  mkdirSync(dirname(authStatePath), { recursive: true });
  writeFileSync(authStatePath, `${JSON.stringify(state, null, 2)}\n`);
});
