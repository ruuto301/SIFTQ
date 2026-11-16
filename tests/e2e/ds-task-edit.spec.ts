import { expect, test } from "./fixtures";
import { descriptionEditor, waitForPageSettle } from "./task-helpers";
import type { Page } from "@playwright/test";

async function createTask(page: Page, title: string, description: string) {
  await page.goto("/tasks");
  await page.getByRole("link", { name: "New task" }).click();
  await page.getByLabel("Title").fill(title);
  await descriptionEditor(page).fill(description);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
}

async function openTaskInDs(page: Page, title: string) {
  await page.goto("/ds");
  await page.locator(".ds__task").filter({ hasText: title }).click();
  await expect(page.locator("#ds-task-title")).toHaveValue(title);
  // The DS pane is server-rendered; wait for the deferred scripts that wire the
  // save, revert and tab handlers before interacting.
  await waitForPageSettle(page);
}

test("edits title and description in the DS task tab (BDD-TM-036)", async ({ page }) => {
  const title = `ds edit ${Date.now()}`;
  const description = "最初の説明";
  await createTask(page, title, description);
  await openTaskInDs(page, title);

  await expect(page.locator("#ds-task-description")).toHaveValue(description);

  const updatedTitle = `${title} 更新`;
  const updatedDescription = "更新した説明\n- 追記";
  await page.locator("#ds-task-title").fill(updatedTitle);
  await expect(page.locator("#ds-task-status")).toHaveText("未保存の変更");
  // A stored description opens on プレビュー, so switch to 編集 before typing.
  await page.getByRole("tab", { name: "編集" }).click();
  await page.locator("#ds-description-editor").fill(updatedDescription);

  await page.locator("#ds-task-save").click();
  await expect(page.locator("#ds-task-status")).toHaveText("保存しました");

  // The left pane card follows the save without a page reload.
  await expect(page.locator(".ds__task").filter({ hasText: updatedTitle })).toHaveCount(1);

  // The change is persisted.
  await page.reload();
  await expect(page.locator("#ds-task-title")).toHaveValue(updatedTitle);
  await expect(page.locator("#ds-task-description")).toHaveValue(updatedDescription);
});

test("saves with Ctrl + Enter and reverts with Escape (BDD-TM-036)", async ({ page }) => {
  const title = `ds keys ${Date.now()}`;
  await createTask(page, title, "キー操作の説明");
  await openTaskInDs(page, title);

  await page.locator("#ds-task-title").fill(`${title} 変更`);
  await page.locator("#ds-task-title").press("Escape");
  await expect(page.locator("#ds-task-title")).toHaveValue(title);
  await expect(page.locator("#ds-task-status")).toHaveText("");

  const saved = `${title} 保存`;
  await page.locator("#ds-task-title").fill(saved);
  await page.locator("#ds-task-title").press("Control+Enter");
  await expect(page.locator("#ds-task-status")).toHaveText("保存しました");
  await page.reload();
  await expect(page.locator("#ds-task-title")).toHaveValue(saved);
});

test("rejects an empty title (BDD-TM-036)", async ({ page }) => {
  const title = `ds empty ${Date.now()}`;
  await createTask(page, title, "");
  await openTaskInDs(page, title);

  await page.locator("#ds-task-title").fill("   ");
  await page.locator("#ds-task-save").click();

  await expect(page.locator("#ds-task-error")).toContainText("title を入力してください。");
});
