import { expect, test } from "./fixtures";
import { signIn } from "./task-helpers";
import type { Page } from "@playwright/test";

const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** 画像を合成 paste で本文へ入れる。 */
function dispatchPaste(element: Element, encoded: string): void {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const transfer = new DataTransfer();
  transfer.items.add(new File([bytes], "pixel.png", { type: "image/png", lastModified: 1700000000000 }));
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", { value: transfer });
  element.dispatchEvent(event);
}

async function pasteInto(page: Page, selector: string): Promise<void> {
  await page.locator(selector).click();
  await page.locator(selector).evaluate(dispatchPaste, PIXEL_PNG.toString("base64"));
}

test("edits the Ideas body without a tab switch and shows images inline (BDD-TM-061)", async ({ page }) => {
  await signIn(page);
  await page.goto("/ideas");
  await page.locator("[data-idea-composer-trigger]").click();

  const composer = page.locator("[data-idea-composer]");
  const title = `Ideas wysiwyg ${Date.now()}`;
  await composer.getByLabel("メモのタイトル").fill(title);
  await expect(composer.getByRole("tab")).toHaveCount(0);

  const composerEditor = composer.locator("[data-idea-body-editor]");
  const composerValue = composer.locator("[data-idea-composer-body]");
  await composerEditor.fill("前後");
  await pasteInto(page, "[data-idea-composer] [data-idea-body-editor]");
  await expect(composerValue).toHaveValue(/pending-/);

  await Promise.all([page.waitForEvent("load"), composer.locator("[data-idea-composer-save]").click()]);
  const card = page.locator(".idea-card").filter({ hasText: title });
  await expect(card).toHaveCount(1);
  await expect(card.locator(".idea-card__image")).toHaveCount(1);

  await card.locator(".idea-card__title").click();
  const detail = page.locator("[data-idea-detail-dialog]");
  await expect(detail).toBeVisible();
  await expect(detail.getByRole("tab")).toHaveCount(0);
  await expect(detail.locator("[data-idea-body-editor] img")).toHaveCount(1);
  await expect(detail.locator("[data-idea-detail-body]")).toHaveValue(/attachments/);
});
