import { expect, test } from "./fixtures";
import { descriptionEditor } from "./task-helpers";
import type { Page } from "@playwright/test";

/** Creates a task from the task list so the description is stored on the task. */
async function createTaskWithDescription(page: Page, title: string, description: string) {
  await page.goto("/tasks");
  await page.getByRole("link", { name: "New task" }).click();
  await page.getByLabel("Title").fill(title);
  await descriptionEditor(page).fill(description);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
}

/** Opens the DS screen with the given task selected, then switches to the description tab. */
async function openTaskInDs(page: Page, title: string) {
  await page.goto("/ds");
  await page.locator(".ds__task").filter({ hasText: title }).click();
  const tab = page.getByRole("tab", { name: "description" });
  await expect(tab).toBeVisible();
  await tab.click();
  await expect(tab).toHaveClass(/active/);
}

test("labels the description tab instead of 説明 (BDD-TM-032)", async ({ page }) => {
  await page.goto("/ds");

  const tabs = page.getByRole("tab");
  await expect(tabs).toHaveCount(3);
  await expect(page.getByRole("tab", { name: "description" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "説明" })).toHaveCount(0);
});

test("renders the stored description without waiting for the transport (BDD-TM-032)", async ({ page }) => {
  const title = `desc task ${Date.now()}`;
  const description = "手順は https://example.com/docs を参照する。\n- 1 つ目\n- 2 つ目";
  await createTaskWithDescription(page, title, description);
  await openTaskInDs(page, title);

  const view = page.locator("#dsh-desc-view");
  await expect(view).toContainText("手順は https://example.com/docs を参照する。");
  await expect(view).toContainText("1 つ目");
  await expect(view).toContainText("2 つ目");
});

test("keeps the placeholder when the task has no description (BDD-TM-032)", async ({ page }) => {
  const title = `no desc task ${Date.now()}`;
  await createTaskWithDescription(page, title, "");
  await openTaskInDs(page, title);

  await expect(page.locator("#dsh-desc-view")).toHaveText("");
});
