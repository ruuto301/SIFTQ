import { expect, test } from "./fixtures";

const REDIRECT_URI = "https://client.example/callback";
const VERIFIER = "siftq-e2e-code-verifier-value-0123456789abcdef";

function base64Url(bytes: Uint8Array): string {
  let encoded = btoa(String.fromCharCode(...Array.from(bytes))).replaceAll("+", "-").replaceAll("/", "_");
  while (encoded.endsWith("=")) encoded = encoded.slice(0, -1);
  return encoded;
}

async function pkceChallenge(): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(VERIFIER));
  return base64Url(new Uint8Array(digest));
}

async function registerClient(page: import("@playwright/test").Page): Promise<string> {
  const response = await page.request.post("/oauth/register", {
    data: { client_name: "E2E Client", redirect_uris: [REDIRECT_URI] },
  });
  expect(response.status()).toBe(201);
  const body = await response.json();
  return String(body["client_id"]);
}

async function acquireToken(page: import("@playwright/test").Page, scope: string): Promise<string> {
  const clientId = await registerClient(page);
  const consent = await page.request.post("/oauth/authorize", {
    form: {
      response_type: "code",
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      code_challenge: await pkceChallenge(),
      code_challenge_method: "S256",
      scope,
      decision: "allow",
    },
    maxRedirects: 0,
  });
  expect(consent.status()).toBe(302);
  const code = new URL(consent.headers()["location"] ?? "").searchParams.get("code") ?? "";
  expect(code).not.toBe("");
  const token = await page.request.post("/oauth/token", {
    form: { grant_type: "authorization_code", code, client_id: clientId, redirect_uri: REDIRECT_URI, code_verifier: VERIFIER },
  });
  expect(token.status()).toBe(200);
  const payload = await token.json();
  return String(payload["access_token"]);
}

test("drives SIFTQ through MCP with a delegated token (BDD-TM-033)", async ({ page }) => {
  const token = await acquireToken(page, "read write");
  const auth = { authorization: `Bearer ${token}` };

  const initialized = await page.request.post("/mcp", {
    headers: auth,
    data: { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "e2e", version: "1" } } },
  });
  expect(initialized.status()).toBe(200);
  expect((await initialized.json())["result"]).toMatchObject({ serverInfo: { name: "siftq" } });

  const listed = await page.request.post("/mcp", { headers: auth, data: { jsonrpc: "2.0", id: 2, method: "tools/list" } });
  const tools = (await listed.json())["result"]["tools"];
  expect(tools.map((tool: { name: string }) => tool.name)).toContain("create_task");

  const title = `mcp task ${Date.now()}`;
  const created = await page.request.post("/mcp", {
    headers: auth,
    data: { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "create_task", arguments: { title, position: "first" } } },
  });
  expect(created.status()).toBe(200);
  const content = (await created.json())["result"]["content"][0].text;
  expect(JSON.parse(content)).toMatchObject({ title, order: 1 });

  await page.goto("/tasks");
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
});

test("rejects write tools for a read-only token (BDD-TM-033)", async ({ page }) => {
  const token = await acquireToken(page, "read");
  const denied = await page.request.post("/mcp", {
    headers: { authorization: `Bearer ${token}` },
    data: { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "delete_task", arguments: { id: "missing", version: 1 } } },
  });
  expect(denied.status()).toBe(403);
});

test("stops accepting a token after it is revoked (BDD-TM-033)", async ({ page }) => {
  const token = await acquireToken(page, "read write");
  const ping = { jsonrpc: "2.0", id: 5, method: "ping" };
  const before = await page.request.post("/mcp", { headers: { authorization: `Bearer ${token}` }, data: ping });
  expect(before.status()).toBe(200);

  const revoked = await page.request.post("/oauth/revoke", { form: { token } });
  expect(revoked.status()).toBe(200);
  const after = await page.request.post("/mcp", { headers: { authorization: `Bearer ${token}` }, data: ping });
  expect(after.status()).toBe(401);
});
