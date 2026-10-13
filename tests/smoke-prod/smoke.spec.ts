import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";

const authStatePath = fileURLToPath(new URL("../../tmp/smoke-prod/auth.json", import.meta.url));
const BASE_URL = process.env["SMOKE_BASE_URL"] ?? "https://app.siftq-app.workers.dev";
const MARK = "[smoke]";
const runId = `${MARK} ${Date.now()}`;

type TaskRow = { id: string; title: string; version: number };
type IdeaRow = { id: string; title: string };

async function deleteSmokeData(request: APIRequestContext): Promise<void> {
  let failed = false;

  const tasks: TaskRow[] = await (await request.get("/api/tasks")).json();
  for (const task of tasks) {
    if (!task.title.startsWith(MARK)) continue;
    const response = await request.delete(`/api/tasks/${task.id}`, { data: { version: task.version } });
    if (response.status() !== 204) failed = true;
  }

  const ideas: IdeaRow[] = await (await request.get("/api/ideas")).json();
  for (const idea of ideas) {
    if (!idea.title.startsWith(MARK)) continue;
    const response = await request.delete(`/api/ideas/${idea.id}`);
    if (response.status() !== 204) failed = true;
  }

  if (failed) throw new Error("production smoke cleanup failed; smoke data may remain");
}

test("rejects unauthenticated requests", async ({ playwright }) => {
  const anonymous = await playwright.request.newContext({
    baseURL: BASE_URL,
    maxRedirects: 0,
    storageState: { cookies: [], origins: [] },
  });
  try {
    expect((await anonymous.get("/api/tasks")).status()).toBe(401);
    const home = await anonymous.get("/");
    expect(home.status()).toBe(302);
    expect(home.headers()["location"]).toContain("/login");
  } finally {
    await anonymous.dispose();
  }
});

test("creates, reorders, and edits with an authenticated session", async ({ page }) => {
  await page.goto("/matrix");
  await expect(page.getByRole("heading", { name: "Matrix" })).toBeVisible();

  const title = `${runId} task`;
  await page.goto("/tasks/new");
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/tasks(\?|$)/);
  await page.waitForLoadState("load");

  const listed: TaskRow[] = await (await page.request.get("/api/tasks")).json();
  const created = listed.find((task) => task.title === title);
  if (created === undefined) throw new Error("created task was not found in the task list");
  const id = created.id;

  await page.goto("/matrix");
  const card = page.locator(".task-card", { hasText: title });
  await expect(card).toBeVisible();
  const target = page.locator('.area--quadrant[data-drop-area="4"] .matrix-cards');
  const reorder = page.waitForResponse(
    (response) => response.url().includes("/api/tasks/reorder") && response.request().method() === "POST",
  );
  await card.dragTo(target);
  expect((await reorder).status()).toBe(200);

  await page.reload();
  await expect(page.locator('.area--quadrant[data-drop-area="4"] .task-card', { hasText: title })).toBeVisible();

  await page.goto(`/tasks/${id}`);
  const editedTitle = `${title} edited`;
  await page.getByLabel("Title").fill(editedTitle);
  const saved = page.waitForResponse(
    (response) => response.url().includes(`/tasks/${id}`) && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Save" }).click();
  await saved;
  const detail: TaskRow = await (await page.request.get(`/api/tasks/${id}`)).json();
  expect(detail.title).toBe(editedTitle);
});

test.afterAll(async ({ playwright }) => {
  const request = await playwright.request.newContext({ baseURL: BASE_URL, storageState: authStatePath });
  try {
    await deleteSmokeData(request);
  } finally {
    await request.dispose();
  }
});
