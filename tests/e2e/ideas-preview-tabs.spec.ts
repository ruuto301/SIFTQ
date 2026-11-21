import { expect, test } from "./fixtures";
import { signIn } from "./task-helpers";

const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** 画像を合成 paste で本文へ入れる（ファイル選択は添付欄に入るため使わない）。 */
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

test("shows the pasted image in the Ideas preview tab (BDD-TM-060)", async ({ page }) => {
  await signIn(page);
  await page.goto("/ideas");
  await page.locator("[data-idea-composer-trigger]").click();

  const composer = page.locator("[data-idea-composer]");
  const title = `Ideas preview ${Date.now()}`;
  await composer.getByLabel("メモのタイトル").fill(title);

  // 既定は「編集」— 本文の textarea がそのまま見える
  await expect(composer.getByLabel("メモの本文")).toBeVisible();
  await expect(composer.getByRole("tab", { name: "編集" })).toHaveAttribute("aria-selected", "true");

  await composer.getByLabel("メモの本文").click();
  await composer
    .getByLabel("メモの本文")
    .evaluate(dispatchPaste, PIXEL_PNG.toString("base64"));
  // composer では保存時に添付 URL へ置き換わるため、ここでは仮トークンを確認する。
  await expect(composer.getByLabel("メモの本文")).toHaveValue(/pending-/);
  await Promise.all([page.waitForEvent("load"), composer.locator("[data-idea-composer-save]").click()]);

  // 保存後、詳細ダイアログのプレビューに画像が出る
  const card = page.locator(".idea-card").filter({ hasText: title });
  await expect(card).toHaveCount(1);
  await card.locator(".idea-card__title").click();

  const detail = page.locator("[data-idea-detail-dialog]");
  await expect(detail).toBeVisible();
  await expect(detail.getByLabel("メモの本文")).toHaveValue(/attachments/);
  await detail.getByRole("tab", { name: "プレビュー" }).click();
  await expect(detail.locator("[data-description-preview] img")).toHaveCount(1);
});
