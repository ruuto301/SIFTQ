import { expect, test } from "./fixtures";
import { signIn } from "./task-helpers";
import type { Locator, Page } from "@playwright/test";

async function createNote(page: Page, title: string, body: string) {
  await page.goto("/ideas");
  await page.locator("[data-idea-composer-trigger]").click();
  const composer = page.locator("[data-idea-composer]");
  await composer.getByLabel("メモのタイトル").fill(title);
  await composer.getByLabel("メモの本文").fill(body);
  // The save reloads the page; wait for it before touching the card.
  await Promise.all([page.waitForEvent("load"), page.locator("[data-idea-composer-save]").click()]);
  await expect(page.locator(".idea-card").filter({ hasText: title })).toHaveCount(1);
}

async function openDetail(page: Page, title: string) {
  await page.locator(".idea-card").filter({ hasText: title }).locator(".idea-card__title").click();
  const dialog = page.locator("[data-idea-detail-dialog]");
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
  // Keep's toolbar: more, background colour and close. Archive lives in the more menu.
  for (const control of ["palette", "close", "pin"]) {
    await expect(dialog.locator(`[data-idea-detail-${control}]`)).toBeVisible();
  }
  await expect(dialog.locator("[data-idea-detail-archive]")).toBeHidden();
  await dialog.locator(".idea-detail__more summary").click();
  await expect(dialog.locator("[data-idea-detail-archive]")).toBeVisible();
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
  await expect(page.locator(".idea-card").filter({ hasText: updated })).toHaveCount(1);

  await dialog.getByRole("button", { name: "閉じる" }).click();
  await expect(page.locator("[data-idea-detail-dialog]")).toBeHidden();

  await page.reload();
  await expect(page.locator(".idea-card").filter({ hasText: updated })).toHaveCount(1);
  await expect(page.locator(".idea-card").filter({ hasText: updated })).toContainText("更新した本文");
});

test("changes the colour and pins the note from the dialog (BDD-TM-044)", async ({ page }) => {
  await signIn(page);
  const title = `detail color ${Date.now()}`;
  await createNote(page, title, "");
  const card = page.locator(".idea-card").filter({ hasText: title });

  const dialog = await openDetail(page, title);
  await dialog.locator("[data-idea-detail-palette]").click();
  await dialog.locator('[data-idea-detail-color="red"]').click();
  await expect(card).toHaveAttribute("data-idea-color", "red");

  await dialog.locator("[data-idea-detail-pin]").click();
  await expect(card).toHaveAttribute("data-idea-pinned", "true");
});

test("deletes the note from the dialog with a confirmation (BDD-TM-044)", async ({ page }) => {
  await signIn(page);
  const title = `detail delete ${Date.now()}`;
  await createNote(page, title, "");

  const dialog = await openDetail(page, title);
  await dialog.locator(".idea-detail__more summary").click();
  await dialog.locator("[data-idea-detail-delete]").click();

  await expect(page.locator(".matrix-modal-text")).toContainText("このメモを削除しますか？");
  await page.locator(".matrix-modal-button--danger").click();

  await expect(page.locator(".idea-card").filter({ hasText: title })).toHaveCount(0);
});

test("closes the dialog with Escape (BDD-TM-044)", async ({ page }) => {
  await signIn(page);
  const title = `detail esc ${Date.now()}`;
  await createNote(page, title, "");

  const dialog = await openDetail(page, title);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

/** The body must not scroll on its own; only the dialog body does. A couple of pixels of rounding is fine. */
async function innerScroll(locator: Locator): Promise<number> {
  return locator.evaluate((el) => el.scrollHeight - el.clientHeight);
}

async function boxHeight(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error("the element is missing");
  return Math.round(box.height);
}

test("grows with the memo body and keeps a single scrollbar (BDD-TM-048)", async ({ page }) => {
  await signIn(page);
  const title = `desc grow ${Date.now()}`;
  await createNote(page, title, "短い本文");

  const dialog = await openDetail(page, title);
  const body = dialog.locator("[data-idea-detail-body]");
  const scroller = dialog.locator("[data-idea-detail-scroll]");

  // A short memo makes a small dialog and the body never scrolls on its own.
  const short = await boxHeight(dialog);
  expect(short).toBeLessThan(260);
  expect(await innerScroll(body)).toBeLessThanOrEqual(2);

  const long = Array.from({ length: 60 }, (_, index) => `- 行 ${index + 1}`).join("\n");
  await dialog.getByLabel("メモの本文").fill(long);

  await expect.poll(async () => boxHeight(dialog)).toBeGreaterThan(short + 100);
  const grown = await boxHeight(dialog);
  expect(grown).toBeLessThanOrEqual(960 * 0.9);
  // Only the dialog body scrolls once the memo is taller than the cap.
  expect(await innerScroll(scroller)).toBeGreaterThan(10);
  expect(await innerScroll(body)).toBeLessThanOrEqual(2);
});

test("grows the composer body while typing (BDD-TM-048)", async ({ page }) => {
  await signIn(page);
  await page.goto("/ideas");
  await page.locator("[data-idea-composer-trigger]").click();

  const composer = page.locator("[data-idea-composer]");
  const body = composer.getByLabel("メモの本文");
  const before = await boxHeight(body);

  await body.fill(Array.from({ length: 8 }, (_, index) => `行 ${index + 1}`).join("\n"));
  expect(await boxHeight(body)).toBeGreaterThan(before);
});
