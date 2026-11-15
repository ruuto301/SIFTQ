import { expect, test } from "./fixtures";
import { createTask } from "./task-helpers";
import type { Page } from "@playwright/test";

async function openTask(page: Page, title: string) {
  await page.goto("/tasks");
  await createTask(page, title, "Yoriwake");
  await page.goto("/ds");
  await page.locator(".ds__task-item", { hasText: title }).locator(".ds__task").click();
  await expect(page.locator("#ds-task-title")).toHaveValue(title);
}

test("saves the task pane with Ctrl + S (BDD-TM-041)", async ({ page }) => {
  const title = `ctrl s ${Date.now()}`;
  await openTask(page, title);

  const updated = `${title} 更新`;
  await page.locator("#ds-task-title").fill(updated);
  await expect(page.locator("#ds-task-status")).toHaveText("未保存の変更");

  await page.keyboard.press("Control+s");

  await expect(page.locator("#ds-task-status")).toHaveText("保存しました");
  // The save is persisted, not just painted.
  await page.reload();
  await expect(page.locator("#ds-task-title")).toHaveValue(updated);
});

test("does not save when Ctrl + S has nothing to save (BDD-TM-041)", async ({ page }) => {
  const title = `ctrl s clean ${Date.now()}`;
  await openTask(page, title);

  // A save bumps the stored version, so an unchanged version proves no request was sent.
  const version = await page.locator("#ds-task").getAttribute("data-task-version");
  await page.keyboard.press("Control+s");

  await page.reload();
  await expect(page.locator("#ds-task")).toHaveAttribute("data-task-version", version ?? "1");
  await expect(page.locator("#ds-task-status")).toHaveText("");
});
