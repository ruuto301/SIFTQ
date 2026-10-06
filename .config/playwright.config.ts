import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";
import { authStatePath } from "../tests/e2e/fixtures";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const e2eSecret = atob("dGVzdC1zZWNyZXQ=");
const e2ePort = Number(process.env["E2E_PORT"] ?? 4173);
const e2eMockPort = e2ePort + 1;
const e2eLogin = "e2e-user";
const e2eMockBase = `http://localhost:${e2eMockPort}`;

export default defineConfig({
  testDir: "../tests/e2e",
  outputDir: path.join(repoRoot, "tmp/test-results"),
  // E2E files share one local D1 database and Worker process.
  workers: 1,
  retries: process.env["CI"] ? 1 : 0,
  reporter: process.env["CI"] ? [["github"], ["list"]] : [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${e2ePort}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1440, height: 960 },
  },
  webServer: [
    {
      command: `bun run dev --host 127.0.0.1 --port ${e2ePort}`,
      port: e2ePort,
      reuseExistingServer: !process.env["CI"],
      env: {
        SESSION_SECRET: e2eSecret,
        GITHUB_CLIENT_ID: "e2e-client-id",
        GITHUB_CLIENT_SECRET: "e2e-client-secret",
        GITHUB_ALLOWED_LOGIN: e2eLogin,
        GITHUB_OAUTH_BASE: e2eMockBase,
        GITHUB_API_BASE: e2eMockBase,
      },
    },
    {
      command: "bun tests/e2e/mock-github-server.ts",
      port: e2eMockPort,
      cwd: repoRoot,
      reuseExistingServer: !process.env["CI"],
      env: {
        GITHUB_MOCK_PORT: String(e2eMockPort),
        GITHUB_MOCK_LOGIN: e2eLogin,
        GITHUB_MOCK_CALLBACK: `http://127.0.0.1:${e2ePort}/auth/github/callback`,
      },
    },
  ],
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 960 },
        storageState: authStatePath,
      },
    },
  ],
});
