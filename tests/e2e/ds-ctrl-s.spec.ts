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

test("does not save on Ctrl + S and leaves the browser default alone (BDD-TM-041)", async ({ page }) => {
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
  // test assert that the pane neither prevents the default nor saves.
  const prevented = await page.locator("#ds-task-title").evaluate((input) => {
    const event = new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true, cancelable: true });
    input.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(prevented).toBe(false);
  await expect(page.locator("#ds-task-status")).toHaveText("未保存の変更");
  expect(patches).toEqual([]);

  // The title is still unsaved: reload brings the stored title back.
  await page.reload();
  await expect(page.locator("#ds-task-title")).toHaveValue(title);
});

test("does not show a save button or shortcut hint (BDD-TM-041)", async ({ page }) => {
  const title = `ctrl s clean ${Date.now()}`;
  await openTask(page, title);

  await expect(page.locator("#ds-task-save")).toHaveCount(0);
  await expect(page.getByText("Ctrl + S")).toHaveCount(0);
});
