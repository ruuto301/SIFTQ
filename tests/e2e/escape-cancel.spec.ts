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

async function createIdea(page: Page, title: string): Promise<{ id: string }> {
  return page.evaluate(async (ideaTitle) => {
    const response = await fetch("/api/ideas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: ideaTitle, description: "" }),
    });
    if (!response.ok) throw new Error(`create idea failed: ${response.status}`);
    return response.json();
  }, title);
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

test("cancels the matrix delete modal with Escape", async ({ page }) => {
  await signIn(page);
  const title = `E2E Escape matrix ${Date.now()}`;
  await createTask(page, title);
  await page.goto("/matrix");
  await expect(page.getByRole("heading", { name: "Matrix" })).toBeVisible();

  const card = page.locator(".task-card", { hasText: title });
  await card.click({ button: "right" });
  await page.locator('.matrix-menu [data-matrix-action="delete"]').click();
  await expect(page.locator(".matrix-modal")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.locator(".matrix-modal")).toHaveCount(0);
  await expect(card).toBeVisible();
});

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

test("closes the idea delete modal with Escape", async ({ page }) => {
  await signIn(page);
  const created = await createIdea(page, `E2E Escape idea modal ${Date.now()}`);
  await page.goto("/ideas");

  const card = page.locator(`.idea-card[data-idea-id="${created.id}"]`);
  await card.locator(".idea-card__more").click();
  await page.locator('.matrix-menu [data-idea-action="delete"]').click();
  await expect(page.locator(".matrix-modal")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.locator(".matrix-modal")).toHaveCount(0);
  await expect(card).toHaveCount(1);
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

test("closes the idea composer with Escape", async ({ page }) => {
  await signIn(page);
  await page.goto("/ideas");

  const composer = page.locator("[data-idea-composer]");
  await composer.locator("[data-idea-composer-trigger]").click();
  await expect(composer).toHaveAttribute("data-idea-composer-open", "true");

  await page.keyboard.press("Escape");
  await expect(composer).toHaveAttribute("data-idea-composer-open", "false");
});

test("saves and closes the idea detail modal with Escape", async ({ page }) => {
  await signIn(page);
  await createIdea(page, `E2E Escape detail ${Date.now()}`);
  await page.goto("/ideas");

  const card = page.locator(".idea-card").first();
  await card.locator("h2").click();
  const modal = page.locator("[data-idea-modal]");
  await expect(modal).toBeVisible();
  await modal.locator("input[name='title']").fill("E2E Escape detail saved");

  const saved = page.waitForResponse(
    (response) => response.url().includes("/api/ideas/") && response.request().method() === "PATCH",
  );
  await page.keyboard.press("Escape");
  await saved;
  await expect(modal).toBeHidden();
});

test("navigates the idea detail page to the list with Escape", async ({ page }) => {
  await signIn(page);
  const created = await createIdea(page, `E2E Escape page ${Date.now()}`);
  await page.goto(`/ideas/${created.id}`);

  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/ideas$/);
});
