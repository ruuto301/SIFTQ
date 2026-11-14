import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { signIn } from "./task-helpers";

async function clearNotes(page: Page) {
  const notes = await page.evaluate(async () => {
    const response = await fetch("/api/mk/notes");
    return response.json();
  });
  for (const note of notes) {
    await page.evaluate(async (id) => {
      await fetch(`/api/mk/notes/${id}`, { method: "DELETE" });
    }, note.id);
  }
}

test("creates, pins, searches, bulk recolors, and deletes an MK note", async ({ page }) => {
  await signIn(page);
  await clearNotes(page);
  await page.goto("/mk");
  await expect(page.getByRole("heading", { name: "MK" })).toBeVisible();

  const title = `MK e2e ${Date.now()}`;
  await page.locator("[data-mk-composer-trigger]").click();
  await page.getByLabel("メモのタイトル").fill(title);
  await page.getByLabel("メモの本文").fill("e2e body");
  await page.locator('[data-mk-composer-color="blue"]').click();
  await page.locator("[data-mk-composer-save]").click();

  const card = page.locator(".mk-card").filter({ hasText: title });
  await expect(card).toHaveCount(1);
  await expect(card).toHaveAttribute("data-mk-color", "blue");
  await expect(card.locator(".mk-card__body")).toHaveText("e2e body");
  await expect(page.locator('[data-mk-count="all"]')).toContainText("1");

  await card.locator("[data-mk-pin]").click();
  await expect(page.locator(".mk-card").filter({ hasText: title })).toHaveAttribute("data-mk-pinned", "true");
  await expect(page.locator('[data-mk-count="pinned"]')).toContainText("1");

  await page.getByLabel("メモを検索").fill(title);
  await page.getByLabel("メモを検索").press("Enter");
  await expect(page).toHaveURL(/[?&]q=/);
  await expect(page.locator(".mk-card")).toHaveCount(1);
  await expect(page.locator(".mk-card").filter({ hasText: title })).toBeVisible();

  await page.goto("/mk");
  await page.locator("[data-mk-selection-toggle]").click();
  await page.locator(".mk-card").filter({ hasText: title }).locator("[data-mk-select]").check();
  await expect(page.locator("[data-mk-bulk-bar]")).toBeVisible();
  await page.locator('[data-mk-bulk-color="red"]').click();
  await expect(page.locator(".mk-card").filter({ hasText: title })).toHaveAttribute("data-mk-color", "red");

  await page.locator(".mk-card").filter({ hasText: title }).locator("[data-mk-delete]").click();
  await expect(page.locator(".matrix-modal")).toContainText("このメモを削除しますか？");
  await page.locator(".matrix-modal-button--danger").click();
  await expect(page.locator(".mk-card").filter({ hasText: title })).toHaveCount(0);
  await expect(page.locator('[data-mk-count="all"]')).toContainText("0");
});
