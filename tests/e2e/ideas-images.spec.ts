import { expect, test } from "./fixtures";
import { signIn } from "./task-helpers";

const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("attaches an image to an Ideas note and removes it", async ({ page }) => {
  await signIn(page);
  await page.goto("/ideas");
  await expect(page.getByRole("heading", { name: "Ideas", exact: true })).toBeVisible();

  const title = `Ideas image e2e ${Date.now()}`;
  await page.locator("[data-idea-composer-trigger]").click();
  await page.locator("[data-idea-composer]").getByLabel("メモのタイトル").fill(title);
  await page.locator("[data-idea-composer-file]").setInputFiles({ name: "pixel.png", mimeType: "image/png", buffer: PIXEL_PNG });

  const pending = page.locator("[data-idea-composer-image]");
  await expect(pending).toHaveCount(1);
  await expect(pending.locator("img")).toHaveAttribute("src", /^\/api\/images\//);
  await page.locator("[data-idea-composer-save]").click();

  const card = page.locator(".idea-card").filter({ hasText: title });
  await expect(card).toHaveCount(1);
  const thumbnail = card.locator("img.idea-card__image");
  await expect(thumbnail).toHaveCount(1);
  await expect(thumbnail).toHaveAttribute("src", /^\/api\/images\//);

  await page.goto("/ideas");
  await page.locator(".idea-card").filter({ hasText: title }).locator("[data-idea-image-remove]").click();
  await expect(page.locator(".matrix-modal")).toContainText("この画像を削除しますか？");
  await page.locator(".matrix-modal-button--danger").click();
  await expect(page.locator(".idea-card").filter({ hasText: title }).locator("img.idea-card__image")).toHaveCount(0);
});
