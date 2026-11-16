import { expect, test } from "./fixtures";
import { signIn } from "./task-helpers";

const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("attaches an image through the composer and serves it from the attachments API", async ({ page }) => {
  await signIn(page);
  await page.goto("/ideas");
  await expect(page.getByRole("heading", { name: "Ideas", exact: true })).toBeVisible();

  const title = `Ideas image e2e ${Date.now()}`;
  await page.locator("[data-idea-composer-trigger]").click();
  await page.locator("[data-idea-composer]").getByLabel("メモのタイトル").fill(title);
  await page.locator("[data-idea-composer-file]").setInputFiles({
    name: "pixel.png",
    mimeType: "image/png",
    buffer: PIXEL_PNG,
  });

  const pending = page.locator("[data-idea-composer-image]");
  await expect(pending).toHaveCount(1);
  await expect(pending.locator("img.idea-composer__image-thumb")).toHaveAttribute("src", /^blob:/);
  await page.locator("[data-idea-composer-save]").click();

  const card = page.locator(".idea-card").filter({ hasText: title });
  await expect(card).toHaveCount(1);
  await expect(page.locator("[data-idea-page]")).toHaveAttribute("data-idea-initialized", "true");
  const chip = card.locator("[data-idea-attachment-id]");
  await expect(chip).toHaveCount(1);
  await expect(chip.locator("img.idea-attachment__thumb")).toHaveAttribute("src", /^\/api\/attachments\//);

  await page.goto("/ideas");
  await page.locator(".idea-card").filter({ hasText: title }).locator("[data-idea-attachment-remove]").click();
  await expect(page.locator(".idea-card").filter({ hasText: title }).locator("[data-idea-attachment-id]")).toHaveCount(
    0,
  );
});
