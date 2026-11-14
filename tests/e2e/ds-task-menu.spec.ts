import { expect, test } from "./fixtures";
import { createTask } from "./task-helpers";

test("opens the English action menu on a DS task (BDD-TM-030)", async ({ page }) => {
  const title = `menu ${Date.now()}`;
  await page.goto("/tasks");
  await createTask(page, title, "Yoriwake");
  await page.goto("/ds");

  await page.locator(".ds__task-item", { hasText: title }).click({ button: "right" });
  const menu = page.locator(".matrix-menu");
  await expect(menu).toBeVisible();
  await expect(menu.locator(".ds-menu__title")).toHaveText(title);
  await expect(menu.locator(".ds-menu__meta")).toHaveText("do ・ Yoriwake");
  await expect(menu.locator(".ds-menu__chip")).toHaveText(["do", "done", "skip"]);
  await expect(menu.locator(".ds-menu__chip.is-active")).toHaveText("do");
  await expect(menu.locator(".ds-menu__row", { hasText: "project" })).toContainText("Yoriwake");
  await expect(menu.getByText("copy title", { exact: true })).toBeVisible();
  await expect(menu.locator(".ds-menu__row", { hasText: "working" })).toContainText("off");
  await expect(menu.getByText("delete", { exact: true })).toBeVisible();
  await expect(menu.getByText("タスク詳細を開く")).toHaveCount(0);
  await expect(menu.getByText("リンクをコピー")).toHaveCount(0);
});

test("copies the task title and changes the status from the menu (BDD-TM-030)", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const title = `menu copy ${Date.now()}`;
  await page.goto("/tasks");
  await createTask(page, title, "Yoriwake");
  await page.goto("/ds");

  await page.locator(".ds__task-item", { hasText: title }).click({ button: "right" });
  await page.locator(".matrix-menu").getByText("copy title", { exact: true }).click();
  await expect(page.locator("#ds-groups-status")).toHaveText("copied");
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(title);

  await page.locator(".ds__task-item", { hasText: title }).click({ button: "right" });
  await page.locator(".matrix-menu .ds-menu__chip", { hasText: "done" }).click();
  await expect(page.locator(".ds__task-item", { hasText: title })).toHaveCount(0);
});
