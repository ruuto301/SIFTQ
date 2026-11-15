import { expect, test } from "./fixtures";
import { signIn } from "./task-helpers";

const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("attaches an image to an MK note and removes it", async ({ page }) => {
  await signIn(page);
  await page.goto("/mk");
  await expect(page.getByRole("heading", { name: "MK", exact: true })).toBeVisible();

  const title = `MK image e2e ${Date.now()}`;
  await page.locator("[data-mk-composer-trigger]").click();
  await page.getByLabel("メモのタイトル").fill(title);
  await page.locator("[data-mk-composer-file]").setInputFiles({ name: "pixel.png", mimeType: "image/png", buffer: PIXEL_PNG });

  const pending = page.locator("[data-mk-composer-image]");
  await expect(pending).toHaveCount(1);
  await expect(pending.locator("img")).toHaveAttribute("src", /^\/api\/images\//);
  await page.locator("[data-mk-composer-save]").click();

  const card = page.locator(".mk-card").filter({ hasText: title });
  await expect(card).toHaveCount(1);
  const thumbnail = card.locator("img.mk-card__image");
  await expect(thumbnail).toHaveCount(1);
  await expect(thumbnail).toHaveAttribute("src", /^\/api\/images\//);

  await page.goto("/mk");
  await page.locator(".mk-card").filter({ hasText: title }).locator("[data-mk-image-remove]").click();
  await expect(page.locator(".matrix-modal")).toContainText("この画像を削除しますか？");
  await page.locator(".matrix-modal-button--danger").click();
  await expect(page.locator(".mk-card").filter({ hasText: title }).locator("img.mk-card__image")).toHaveCount(0);
});
