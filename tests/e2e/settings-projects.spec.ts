import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";
import { createTask, expectTaskVisibleInList, signIn } from "./task-helpers";

async function openSettings(page: Page) {
  await page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("link", { name: "Settings", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
}

function projectRow(page: Page, name: string) {
  return page.locator("[data-settings-row]", { hasText: name });
}

test("shows Settings after DS in the navigation and lists the projects", async ({ page }) => {
  await signIn(page);

  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav.getByRole("link")).toHaveText(["Ideas", "MK", "Tasks", "DS", "Settings"]);

  await openSettings(page);
  for (const name of ["Yoriwake", "affiliate", "customer_portal", "生活"]) {
    await expect(projectRow(page, name)).toHaveCount(1);
  }
  await expect(page.locator("[data-settings-page]")).toContainText("未分類:");
});

test("adds a project from the settings page", async ({ page }) => {
  await signIn(page);
  await openSettings(page);

  const name = `家計 ${Date.now()}`;
  await page.getByLabel("新しいプロジェクト名").fill(name);
  await page.getByRole("button", { name: "追加" }).click();

  await expect(projectRow(page, name)).toHaveCount(1);
});

test("renames a project without touching its tasks", async ({ page }) => {
  await signIn(page);
  await openSettings(page);

  // Uses its own project so the test never disturbs the seeded ones.
  const stamp = Date.now();
  const from = `rename-src-${stamp}`;
  const to = `rename-dst-${stamp}`;
  await page.getByLabel("新しいプロジェクト名").fill(from);
  await page.getByRole("button", { name: "追加" }).click();
  await expect(projectRow(page, from)).toHaveCount(1);

  const title = `rename target ${stamp}`;
  await page.goto("/tasks");
  await createTask(page, title, from);

  await openSettings(page);
  await projectRow(page, from).getByRole("button", { name: "名前を編集" }).click();
  const input = page.getByLabel("プロジェクト名", { exact: true });
  await input.fill(to);
  await input.press("Enter");

  // The row keeps the original id, so assert the displayed name.
  await expect(projectRow(page, to).locator("[data-project-name-label]")).toHaveText(to);
  await expectTaskVisibleInList(page, title, "do");
  await expect(page.locator("[data-task-row]", { hasText: title })).toContainText(`#${to}`);

  // Removes the temporary project so repeated runs do not pile up.
  await openSettings(page);
  await projectRow(page, to).getByRole("button", { name: "削除" }).click();
  await page.locator(".matrix-modal-button--danger").click();
  await expect(projectRow(page, to)).toHaveCount(0);
});

test("deleting a project moves its tasks to 未分類 (BDD-TM-035)", async ({ page }) => {
  await signIn(page);
  await openSettings(page);

  const name = `一時 ${Date.now()}`;
  await page.getByLabel("新しいプロジェクト名").fill(name);
  await page.getByRole("button", { name: "追加" }).click();
  await expect(projectRow(page, name)).toHaveCount(1);

  const title = `delete target ${Date.now()}`;
  await page.goto("/tasks");
  await createTask(page, title, name);

  await openSettings(page);
  const row = projectRow(page, name);
  await row.getByRole("button", { name: "削除" }).click();

  // The confirm dialog is the shared centered modal and counts the moved tasks.
  await expect(page.locator(".matrix-modal-text")).toContainText(name);
  await expect(page.locator(".matrix-modal-text")).toContainText("1 件のタスクは未分類になります");
  await page.locator(".matrix-modal-button--danger").click();

  await expect(projectRow(page, name)).toHaveCount(0);
  await expectTaskVisibleInList(page, title, "do");
  await expect(page.locator("[data-task-row]", { hasText: title })).toContainText("未分類");
});
