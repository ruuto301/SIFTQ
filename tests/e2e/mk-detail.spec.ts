import { expect, test } from "./fixtures";
import { signIn } from "./task-helpers";
import type { Page } from "@playwright/test";

async function createNote(page: Page, title: string, body: string) {
  await page.goto("/mk");
  await page.locator("[data-mk-composer-trigger]").click();
  const composer = page.locator("[data-mk-composer]");
  await composer.getByLabel("メモのタイトル").fill(title);
  await composer.getByLabel("メモの本文").fill(body);
  // The save reloads the page; wait for it before touching the card.
  await Promise.all([page.waitForEvent("load"), page.locator("[data-mk-composer-save]").click()]);
  await expect(page.locator(".mk-card").filter({ hasText: title })).toHaveCount(1);
}

async function openDetail(page: Page, title: string) {
  await page.locator(".mk-card").filter({ hasText: title }).locator(".mk-card__title").click();
  const dialog = page.locator("[data-mk-detail-dialog]");
  await expect(dialog).toBeVisible();
  return dialog;
}

test("opens the Keep-style detail dialog from a card (BDD-TM-044)", async ({ page }) => {
  await signIn(page);
  const title = `detail ${Date.now()}`;
  await createNote(page, title, "最初の本文");

  const dialog = await openDetail(page, title);
  await expect(dialog.getByLabel("メモのタイトル")).toHaveValue(title);
  await expect(dialog.getByLabel("メモの本文")).toHaveValue("最初の本文");
  // Keep's toolbar: image, archive, more, background colour and close.
  for (const control of ["archive", "palette", "close", "pin"]) {
    await expect(dialog.locator(`[data-mk-detail-${control}]`)).toBeVisible();
  }
});

test("autosaves the title and body, and keeps them after closing (BDD-TM-044)", async ({ page }) => {
  await signIn(page);
  const title = `detail edit ${Date.now()}`;
  await createNote(page, title, "本文");

  const dialog = await openDetail(page, title);
  const updated = `${title} 更新`;
  await dialog.getByLabel("メモのタイトル").fill(updated);
  await dialog.getByLabel("メモの本文").fill("更新した本文");

  // The card follows the autosave without closing the dialog.
  await expect(page.locator(".mk-card").filter({ hasText: updated })).toHaveCount(1);

  await dialog.getByRole("button", { name: "閉じる" }).click();
  await expect(page.locator("[data-mk-detail-dialog]")).toBeHidden();

  await page.reload();
  await expect(page.locator(".mk-card").filter({ hasText: updated })).toHaveCount(1);
  await expect(page.locator(".mk-card").filter({ hasText: updated })).toContainText("更新した本文");
});

test("changes the colour and pins the note from the dialog (BDD-TM-044)", async ({ page }) => {
  await signIn(page);
  const title = `detail color ${Date.now()}`;
  await createNote(page, title, "");
  const card = page.locator(".mk-card").filter({ hasText: title });

  const dialog = await openDetail(page, title);
  await dialog.locator("[data-mk-detail-palette]").click();
  await dialog.locator('[data-mk-detail-color="red"]').click();
  await expect(card).toHaveAttribute("data-mk-color", "red");

  await dialog.locator("[data-mk-detail-pin]").click();
  await expect(card).toHaveAttribute("data-mk-pinned", "true");
});

test("deletes the note from the dialog with a confirmation (BDD-TM-044)", async ({ page }) => {
  await signIn(page);
  const title = `detail delete ${Date.now()}`;
  await createNote(page, title, "");

  const dialog = await openDetail(page, title);
  await dialog.locator(".mk-detail__more summary").click();
  await dialog.locator("[data-mk-detail-delete]").click();

  await expect(page.locator(".matrix-modal-text")).toContainText("このメモを削除しますか？");
  await page.locator(".matrix-modal-button--danger").click();

  await expect(page.locator(".mk-card").filter({ hasText: title })).toHaveCount(0);
});

test("closes the dialog with Escape (BDD-TM-044)", async ({ page }) => {
  await signIn(page);
  const title = `detail esc ${Date.now()}`;
  await createNote(page, title, "");

  const dialog = await openDetail(page, title);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});
