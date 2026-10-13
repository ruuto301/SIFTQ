import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

// Production smoke: no local webServer, the real Worker is the target, and the
// authenticated session is minted in the setup project (see auth.setup.ts).
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const authStatePath = path.join(repoRoot, "tmp/smoke-prod/auth.json");

export default defineConfig({
  testDir: "../tests/smoke-prod",
  outputDir: path.join(repoRoot, "tmp/smoke-prod/results"),
  // The smoke mutates production data, so run strictly serially.
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env["SMOKE_BASE_URL"] ?? "https://app.siftq-app.workers.dev",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1440, height: 960 },
  },
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
