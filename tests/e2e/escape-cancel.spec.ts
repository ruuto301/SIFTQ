import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

async function signIn(page: Page) {
  await page.goto("/ideas");
  await expect(page).toHaveURL(/\/ideas$/);
}

async function createTask(page: Page, title: string) {
  const status = await page.evaluate(async (taskTitle) => {
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: taskTitle, description: "" }),
    });
    return response.status;
  }, title);
  expect(status).toBe(201);
}

async function selectTask(page: Page, title: string) {
  await page.goto("/tasks?status=do");
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const row = page.locator("[data-task-row]", { hasText: title });
    if ((await row.count()) > 0) {
      await row.getByRole("checkbox").check();
      return;
    }
    const next = page.getByRole("link", { name: "Next page" });
    if ((await next.count()) === 0) break;
    await next.click();
  }
  throw new Error(`Task was not found in the task list: ${title}`);
}

test("cancels the task list delete modal with Escape", async ({ page }) => {
  await signIn(page);
  const title = `E2E Escape bulk ${Date.now()}`;
  await createTask(page, title);
  await selectTask(page, title);

  await page.getByRole("button", { name: "delete" }).click();
  const dialog = page.locator(".matrix-modal");
  await expect(dialog).toContainText("削除しますか？");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("[data-task-row]", { hasText: title })).toBeVisible();
});

test("closes the New Task popover with Escape without leaving the form", async ({ page }) => {
  await signIn(page);
  await page.goto("/tasks/new");

  const statusDetails = page.locator("#new-task-meta details").first();
  await statusDetails.locator("summary").click();
  await expect(page.locator('[aria-label="Apply status to this task"]')).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(statusDetails).not.toHaveAttribute("open");
  await expect(page.locator('[aria-label="Apply status to this task"]')).toBeHidden();
  await expect(page.getByRole("heading", { name: "New task" })).toBeVisible();
});

test("leaves the New Task form with Escape like the Cancel control", async ({ page }) => {
  await signIn(page);
  await page.goto("/tasks");
  await page.getByRole("link", { name: "New task" }).click();
  await expect(page.getByRole("heading", { name: "New task" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
});

