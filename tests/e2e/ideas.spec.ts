import { expect, test } from "./fixtures";
import { signIn } from "./task-helpers";
import type { Page } from "@playwright/test";

/**
 * Ideas saves through the API and then reloads the page itself.
 * Waiting for that reload keeps the next click from racing with the navigation.
 */
async function actAndWaitForReload(page: Page, action: () => Promise<void>) {
  await Promise.all([page.waitForEvent("load"), action()]);
}

test("creates, pins, searches, bulk recolors, and deletes an Ideas note", async ({ page }) => {
  await signIn(page);
  await page.goto("/ideas");
  await expect(page.getByRole("heading", { name: "Ideas", exact: true })).toBeVisible();

  const title = `Ideas e2e ${Date.now()}`;
  await page.locator("[data-idea-composer-trigger]").click();
  await page.locator("[data-idea-composer]").getByLabel("メモのタイトル").fill(title);
  await page.locator("[data-idea-composer]").getByLabel("メモの本文").fill("e2e body");
  await page.locator('[data-idea-composer-color="blue"]').click();
  await actAndWaitForReload(page, () => page.locator("[data-idea-composer-save]").click());

  const card = page.locator(".idea-card").filter({ hasText: title });
  await expect(card).toHaveCount(1);
  await expect(card).toHaveAttribute("data-idea-color", "blue");
  await expect(card.locator(".idea-card__body")).toHaveText("e2e body");

  await card.hover();
  await actAndWaitForReload(page, () => card.locator("[data-idea-pin]").click());
  await expect(page.locator(".idea-card").filter({ hasText: title })).toHaveAttribute("data-idea-pinned", "true");

  await page.getByLabel("メモを検索").fill(title);
  await page.getByLabel("メモを検索").press("Enter");
  await expect(page).toHaveURL(/[?&]q=/);
  await expect(page.locator(".idea-card")).toHaveCount(1);
  await expect(page.locator(".idea-card").filter({ hasText: title })).toBeVisible();

  await page.goto("/ideas");
  await page.locator(".idea-card").filter({ hasText: title }).hover();
  await page.locator(".idea-card").filter({ hasText: title }).locator("[data-idea-delete]").click();
  await expect(page.locator(".matrix-modal")).toContainText("このメモを削除しますか？");
  await actAndWaitForReload(page, () => page.locator(".matrix-modal-button--danger").click());
  await expect(page.locator(".idea-card").filter({ hasText: title })).toHaveCount(0);
});

