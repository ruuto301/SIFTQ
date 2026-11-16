import { expect, test } from "./fixtures";
import { signIn } from "./task-helpers";
import type { Page } from "@playwright/test";

const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
).toString("base64");

const ROUNDTRIP_HTML = [
  "<!doctype html><html><body>",
  '<p id="run-result">スクリプトは無効です</p>',
  "<script>",
  "document.getElementById('run-result').textContent = '実行された';",
  "try { localStorage.setItem('attachment-pwned', '1'); } catch (error) { /* sandboxed */ }",
  "</script>",
  "</body></html>",
].join("");

type DropFile = { readonly name: string; readonly type: string; readonly base64: string };

/** DataTransfer はブラウザ側で組み立てないと file を持てない。 */
async function dataTransferOfFiles(page: Page, files: readonly DropFile[]) {
  return page.evaluateHandle((items: readonly DropFile[]) => {
    const transfer = new DataTransfer();
    for (const item of items) {
      const binary = atob(item.base64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      transfer.items.add(new File([bytes], item.name, { type: item.type }));
    }
    return transfer;
  }, files);
}

/** 大きいファイルはバイト列をブラウザ内で作る。 */
async function dataTransferOfSize(page: Page, name: string, type: string, size: number) {
  return page.evaluateHandle(
    ({ name: fileName, type: mime, size: bytes }) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([new Uint8Array(bytes)], fileName, { type: mime }));
      return transfer;
    },
    { name, type, size },
  );
}

/** クライアントスクリプトが DnD / チップ操作を配線するまで待つ。 */
async function waitForIdeaReady(page: Page) {
  await expect(page.locator("[data-idea-page]")).toHaveAttribute("data-idea-initialized", "true");
}

async function createIdea(page: Page, title: string) {
  await page.goto("/ideas");
  await waitForIdeaReady(page);
  await page.locator("[data-idea-composer-trigger]").click();
  await page.locator("[data-idea-composer]").getByLabel("メモのタイトル").fill(title);
  await page.locator("[data-idea-composer-save]").click();
  const card = page.locator(".idea-card").filter({ hasText: title });
  await expect(card).toHaveCount(1);
  await waitForIdeaReady(page);
  return card;
}

test("attaches an image dropped on an existing idea card", async ({ page }) => {
  await signIn(page);
  const title = `Ideas card drop ${Date.now()}`;
  const card = await createIdea(page, title);

  const transfer = await dataTransferOfFiles(page, [
    { name: "pixel.png", type: "image/png", base64: PIXEL_PNG },
  ]);
  await card.dispatchEvent("dragover", { dataTransfer: transfer });
  await expect(card).toHaveClass(/idea-card--dragover/);
  await expect(card.locator("[data-idea-attachment-drop]")).toBeVisible();

  await card.dispatchEvent("drop", { dataTransfer: transfer });

  const chip = card.locator("[data-idea-attachment-id]");
  await expect(chip).toHaveCount(1);
  await expect(chip.locator("img.idea-attachment__thumb")).toHaveAttribute("src", /^\/api\/attachments\//);
  await expect(card.locator("[data-idea-attachment-count]")).toHaveText("📎 1");
  await expect(card).not.toHaveClass(/idea-card--dragover/);
});

test("previews a dropped HTML file in a sandboxed iframe without running scripts", async ({ page }) => {
  await signIn(page);
  const title = `Ideas html drop ${Date.now()}`;
  const card = await createIdea(page, title);
  await card.locator(".idea-card__title").click();
  await expect(page.locator("[data-idea-detail]")).toBeVisible();

  const transfer = await dataTransferOfFiles(page, [
    { name: "資料.html", type: "text/html", base64: Buffer.from(ROUNDTRIP_HTML, "utf8").toString("base64") },
  ]);
  await page.locator("[data-idea-detail]").dispatchEvent("drop", { dataTransfer: transfer });

  const frame = page.locator("[data-idea-attachment-frame]");
  await expect(frame).toHaveCount(1);
  await expect(frame).toHaveAttribute("sandbox", "");
  await expect(frame).toHaveAttribute("src", /^\/api\/attachments\//);
  await expect(page.frameLocator("[data-idea-attachment-frame]").locator("#run-result")).toHaveText(
    "スクリプトは無効です",
  );
  expect(await page.evaluate(() => window.localStorage.getItem("attachment-pwned"))).toBeNull();
});

test("shows an error when a dropped file is too large", async ({ page }) => {
  await signIn(page);
  const title = `Ideas too large ${Date.now()}`;
  const card = await createIdea(page, title);

  const transfer = await dataTransferOfSize(page, "huge.png", "image/png", 6 * 1024 * 1024);
  await card.dispatchEvent("drop", { dataTransfer: transfer });

  const status = card.locator("[data-idea-attachment-status]");
  await expect(status).toBeVisible();
  await expect(status).toContainText("画像は 5MBまでです");
  await expect(card.locator("[data-idea-attachment-id]")).toHaveCount(0);
});

test("deletes an attachment chip from a card", async ({ page }) => {
  await signIn(page);
  const title = `Ideas delete attachment ${Date.now()}`;
  const card = await createIdea(page, title);

  const transfer = await dataTransferOfFiles(page, [
    { name: "pixel.png", type: "image/png", base64: PIXEL_PNG },
  ]);
  await card.dispatchEvent("drop", { dataTransfer: transfer });
  const chip = card.locator("[data-idea-attachment-id]");
  await expect(chip).toHaveCount(1);

  await chip.locator("[data-idea-attachment-remove]").click();

  await expect(card.locator("[data-idea-attachment-id]")).toHaveCount(0);
  await expect(card.locator("[data-idea-attachment-count]")).toBeHidden();
});
