import { expect, test } from "./fixtures";
import { signIn } from "./task-helpers";
import type { Page } from "@playwright/test";

/**
 * MK saves through the API and then reloads the page itself.
 * Waiting for that reload keeps the next click from racing with the navigation.
 */
async function actAndWaitForReload(page: Page, action: () => Promise<void>) {
  await Promise.all([page.waitForEvent("load"), action()]);
}

test("creates, pins, searches, bulk recolors, and deletes an MK note", async ({ page }) => {
  await signIn(page);
  await page.goto("/mk");
  await expect(page.getByRole("heading", { name: "MK", exact: true })).toBeVisible();

  const title = `MK e2e ${Date.now()}`;
  await page.locator("[data-mk-composer-trigger]").click();
  await page.getByLabel("メモのタイトル").fill(title);
  await page.getByLabel("メモの本文").fill("e2e body");
  await page.locator('[data-mk-composer-color="blue"]').click();
  await actAndWaitForReload(page, () => page.locator("[data-mk-composer-save]").click());

  const card = page.locator(".mk-card").filter({ hasText: title });
  await expect(card).toHaveCount(1);
  await expect(card).toHaveAttribute("data-mk-color", "blue");
  await expect(card.locator(".mk-card__body")).toHaveText("e2e body");

  await actAndWaitForReload(page, () => card.locator("[data-mk-pin]").click());
  await expect(page.locator(".mk-card").filter({ hasText: title })).toHaveAttribute("data-mk-pinned", "true");

  await page.getByLabel("メモを検索").fill(title);
  await page.getByLabel("メモを検索").press("Enter");
  await expect(page).toHaveURL(/[?&]q=/);
  await expect(page.locator(".mk-card")).toHaveCount(1);
  await expect(page.locator(".mk-card").filter({ hasText: title })).toBeVisible();

  await page.goto("/mk");
  await page.locator("[data-mk-selection-toggle]").click();
  await page.locator(".mk-card").filter({ hasText: title }).locator("[data-mk-select]").check();
  await expect(page.locator("[data-mk-bulk-bar]")).toBeVisible();
  await actAndWaitForReload(page, () => page.locator('[data-mk-bulk-color="red"]').click());
  await expect(page.locator(".mk-card").filter({ hasText: title })).toHaveAttribute("data-mk-color", "red");

  await page.goto("/mk");
  await page.locator(".mk-card").filter({ hasText: title }).locator("[data-mk-delete]").click();
  await expect(page.locator(".matrix-modal")).toContainText("このメモを削除しますか？");
  await actAndWaitForReload(page, () => page.locator(".matrix-modal-button--danger").click());
  await expect(page.locator(".mk-card").filter({ hasText: title })).toHaveCount(0);
});

test("switches the MK screen to the dark theme", async ({ page }) => {
  await signIn(page);
  await page.goto("/mk");

  const shell = page.locator("[data-mk-page]");
  const before = await shell.evaluate((element) => getComputedStyle(element).backgroundColor);

  await page.locator("[data-mk-theme]").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  const after = await shell.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(after).not.toBe(before);
  expect(after).toBe("rgb(24, 25, 27)");
});
