import { expect, test } from "./fixtures";
import { createTask, waitForPageSettle } from "./task-helpers";
import type { Page } from "@playwright/test";

async function openTask(page: Page, title: string) {
  await page.goto("/tasks");
  await createTask(page, title, "Yoriwake");
  await page.goto("/ds");
  await page.locator(".ds__task-item", { hasText: title }).locator(".ds__task").click();
  await expect(page.locator("#ds-task-title")).toHaveValue(title);
  await waitForPageSettle(page);
}

test("saves the title with Ctrl + S and blocks the browser default (BDD-TM-041)", async ({ page }) => {
  const title = `ctrl s ${Date.now()}`;
  await openTask(page, title);

  const patches: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "PATCH" && request.url().includes("/api/tasks/")) patches.push(request.url());
  });

  const updated = `${title} 更新`;
  await page.locator("#ds-task-title").fill(updated);
  await expect(page.locator("#ds-task-status")).toHaveText("未保存の変更");

  // A real Ctrl+S would open the browser save dialog; a synthetic keydown lets the
  // test assert the pane prevents the default and saves in the same turn.
  const prevented = await page.locator("#ds-task-title").evaluate((input) => {
    const event = new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true, cancelable: true });
    input.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(prevented).toBe(true);
  await expect(page.locator("#ds-task-status")).toHaveText("保存しました");
  expect(patches).toHaveLength(1);

  // The title is persisted: reload brings the saved title back.
  await page.reload();
  await expect(page.locator("#ds-task-title")).toHaveValue(updated);
});

test("autosaves the title 600ms after typing stops (BDD-TM-041)", async ({ page }) => {
  const title = `title autosave ${Date.now()}`;
  await openTask(page, title);

  const updated = `${title} 自動保存`;
  await page.locator("#ds-task-title").fill(updated);
  await expect(page.locator("#ds-task-status")).toHaveText("未保存の変更");
  await expect(page.locator("#ds-task-status")).toHaveText("保存しました", { timeout: 3000 });

  await page.reload();
  await expect(page.locator("#ds-task-title")).toHaveValue(updated);
});

test("shows the save button and shortcut hint, and saves on click (BDD-TM-041)", async ({ page }) => {
  const title = `ctrl s button ${Date.now()}`;
  await openTask(page, title);

  await expect(page.locator("#ds-task-save")).toHaveText("保存");
  await expect(page.getByText("Ctrl + S で保存 / Esc で取り消し")).toBeVisible();

  const updated = `${title} ボタン保存`;
  await page.locator("#ds-task-title").fill(updated);
  await page.locator("#ds-task-save").click();
  await expect(page.locator("#ds-task-status")).toHaveText("保存しました");

  await page.reload();
  await expect(page.locator("#ds-task-title")).toHaveValue(updated);
});

test("cancels the pending title autosave on Escape (BDD-TM-041)", async ({ page }) => {
  const title = `ctrl s escape ${Date.now()}`;
  await openTask(page, title);

  const patches: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "PATCH" && request.url().includes("/api/tasks/")) patches.push(request.url());
  });
  await page.clock.install();

  await page.locator("#ds-task-title").fill(`${title} 取消`);
  await page.locator("#ds-task-title").press("Escape");
  await expect(page.locator("#ds-task-title")).toHaveValue(title);

  // Past the 600ms debounce: the cancelled autosave must not fire.
  await page.clock.fastForward(1000);
  expect(patches).toEqual([]);
  await expect(page.locator("#ds-task-status")).toHaveText("");
});
