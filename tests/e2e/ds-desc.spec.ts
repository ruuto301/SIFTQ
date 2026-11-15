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

/** Opens the DS screen with the given task selected. The task tab is the default. */
async function openTaskInDs(page: Page, title: string) {
  await page.goto("/ds");
  await page.locator(".ds__task").filter({ hasText: title }).click();
  const tab = page.getByRole("tab", { name: "task" });
  await expect(tab).toHaveClass(/active/);
}

test("shows the task, Chat and 設定 tabs in that order (BDD-TM-032)", async ({ page }) => {
  await page.goto("/ds");

  const tabs = page.getByRole("tab");
  await expect(tabs).toHaveCount(3);
  await expect(tabs).toHaveText(["task", "Chat", "設定"]);
  await expect(page.getByRole("tab", { name: "task" })).toHaveClass(/active/);
  await expect(page.getByRole("tab", { name: "description" })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "説明" })).toHaveCount(0);
});

test("renders the stored description without waiting for the transport (BDD-TM-032)", async ({ page }) => {
  const title = `desc task ${Date.now()}`;
  const description = "手順は https://example.com/docs を参照する。\n- 1 つ目\n- 2 つ目";
  await createTaskWithDescription(page, title, description);
  await openTaskInDs(page, title);

  const field = page.locator("#ds-task-description");
  await expect(field).toHaveValue(/手順は https:\/\/example.com\/docs を参照する。/);
  await expect(field).toHaveValue(/1 つ目/);
  await expect(field).toHaveValue(/2 つ目/);
});

test("keeps an empty description empty (BDD-TM-032)", async ({ page }) => {
  const title = `no desc task ${Date.now()}`;
  await createTaskWithDescription(page, title, "");
  await openTaskInDs(page, title);

  await expect(page.locator("#ds-task-description")).toHaveValue("");
});

test("edits the task that DS selects by default", async ({ page }) => {
  await page.goto("/ds");

  // The route falls back to the first task of the status, so the tab is never empty here.
  await expect(page.locator("#ds-task-title")).not.toHaveValue("");
  await expect(page.locator("#ds-task")).not.toContainText("左のタスクを選択してください。");
});
