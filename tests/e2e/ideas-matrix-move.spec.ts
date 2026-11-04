import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

async function signIn(page: Page) {
  await page.goto("/ideas");
  await expect(page).toHaveURL(/\/ideas$/);
}

async function clearIdeas(page: Page) {
  const ideas = await page.evaluate(async () => (await fetch("/api/ideas")).json());
  for (const idea of ideas) {
    await page.evaluate(async (id) => {
      await fetch(`/api/ideas/${id}`, { method: "DELETE" });
    }, idea.id);
  }
}

async function clearTasks(page: Page) {
  const tasks = await page.evaluate(async () => (await fetch("/api/tasks")).json());
  for (const task of tasks) {
    await page.evaluate(async ({ id, version }) => {
      await fetch(`/api/tasks/${id}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ version }),
      });
    }, task);
  }
}

async function createTask(page: Page, title: string, description = "") {
  return page.evaluate(async ({ title: taskTitle, description: taskDescription }) => {
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: taskTitle, description: taskDescription }),
    });
    if (!response.ok) throw new Error(`create task failed: ${response.status}`);
    return response.json();
  }, { title, description });
}

async function createIdea(page: Page, title: string, description = "") {
  return page.evaluate(async ({ title: ideaTitle, description: ideaDescription }) => {
    const response = await fetch("/api/ideas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: ideaTitle, description: ideaDescription }),
    });
    if (!response.ok) throw new Error(`create idea failed: ${response.status}`);
    return response.json();
  }, { title, description });
}

test("moves a Matrix task to the end of the unpinned Ideas", async ({ page }) => {
  await signIn(page);
  await clearIdeas(page);
  await clearTasks(page);

  const suffix = Date.now();
  const title = `E2E matrix to ideas ${suffix}`;
  const description = "moved from matrix";
  await createTask(page, title, description);
  await createIdea(page, "existing idea", "");

  await page.goto("/matrix");
  const card = page.locator(".task-card", { hasText: title });
  await card.click({ button: "right" });
  const menu = page.locator(".matrix-menu");
  await expect(menu.locator("[data-matrix-action]").first()).toHaveText("Ideasに移動");
  await menu.locator('[data-matrix-action="move-to-idea"]').click();
  await expect(card).toHaveCount(0);

  await page.goto("/ideas");
  const unpinned = page.locator('.ideas-grid[data-idea-group="unpinned"] .idea-card');
  await expect(unpinned.last()).toContainText(title);
  await expect(unpinned.last().locator(".idea-card__description")).toHaveText(description);
});

test("moves an Idea to area 1 of the Matrix and keeps the ellipsis menu delete-only", async ({ page }) => {
  await signIn(page);
  await clearIdeas(page);
  await clearTasks(page);

  const suffix = Date.now();
  const title = `E2E ideas to matrix ${suffix}`;
  const description = "moved from ideas";
  const idea = await createIdea(page, title, description);

  await page.goto("/ideas");
  const card = page.locator(`.idea-card[data-idea-id="${idea.id}"]`);

  await card.locator(".idea-card__more").click();
  await expect(page.locator(".matrix-menu [data-idea-action]")).toHaveText(["削除"]);
  await page.mouse.click(5, 5);
  await expect(page.locator(".matrix-menu")).toHaveCount(0);

  await card.click({ button: "right" });
  const menu = page.locator(".matrix-menu");
  await expect(menu.locator("[data-idea-action]")).toHaveText(["Matrixに移動", "削除"]);
  await menu.locator('[data-idea-action="move-to-task"]').click();
  await expect(card).toHaveCount(0);

  await page.goto("/matrix");
  await expect(page.locator('.area--quadrant[data-drop-area="1"] .task-card', { hasText: title })).toHaveCount(1);

  const tasks = await page.evaluate(async () => (await fetch("/api/tasks")).json());
  expect(tasks).toEqual([
    expect.objectContaining({
      title,
      description,
      status: "do",
      area: 1,
      working: false,
    }),
  ]);
});

test("keeps the card and shows an error when a move fails", async ({ page }) => {
  await signIn(page);
  await clearIdeas(page);
  await clearTasks(page);

  const title = `E2E move failure ${Date.now()}`;
  const idea = await createIdea(page, title, "");

  await page.goto("/ideas");
  await page.route("**/api/ideas/*/move-to-task", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ code: "INTERNAL" }) }),
  );

  const card = page.locator(`.idea-card[data-idea-id="${idea.id}"]`);
  await card.click({ button: "right" });
  await page.locator('.matrix-menu [data-idea-action="move-to-task"]').click();

  await expect(page.locator("#move-error")).toBeVisible();
  await expect(page.locator("#move-error")).toHaveText("移動に失敗しました。もう一度お試しください。");
  await expect(card).toHaveCount(1);
});
