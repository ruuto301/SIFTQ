import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { signIn } from "./task-helpers";

const PIXEL_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/** 貼り付け先の textarea へ合成 paste を送る。同じ画像を 2 件入れて重複排除も試せる。 */
function dispatchPaste(element: Element, payload: { encoded: string; name: string; duplicates: boolean }): void {
  const binary = atob(payload.encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const make = () => new File([bytes], payload.name, { type: "image/png", lastModified: 1700000000000 });
  const transfer = new DataTransfer();
  transfer.items.add(make());
  if (payload.duplicates) transfer.items.add(make());
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", { value: transfer });
  element.dispatchEvent(event);
}

async function pasteImage(page: Page, selector: string, duplicates = false): Promise<void> {
  await page.locator(selector).evaluate(dispatchPaste, { encoded: PIXEL_PNG, name: "pixel.png", duplicates });
}

async function placeCaret(page: Page, selector: string, offset: number): Promise<void> {
  await page.locator(selector).evaluate((element, position) => {
    element.focus();
    // WYSIWYG（contenteditable）では本文のテキストオフセットへキャレットを置く。
    const range = document.createRange();
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let remaining = position;
    let node = walker.nextNode();
    while (node) {
      const length = node.textContent ? node.textContent.length : 0;
      if (remaining <= length) {
        range.setStart(node, remaining);
        range.collapse(true);
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
        }
        return;
      }
      remaining -= length;
      node = walker.nextNode();
    }
  }, offset);
}

async function createIdea(page: Page, title: string, body: string): Promise<void> {
  await page.evaluate(async ({ title: ideaTitle, body: ideaBody }) => {
    const response = await fetch("/api/ideas/notes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: ideaTitle, body: ideaBody }),
    });
    if (!response.ok) throw new Error(`create idea failed: ${response.status}`);
  }, { title, body });
}

test("inserts a pasted screenshot at the caret of the idea detail body (BDD-TM-058)", async ({ page }) => {
  await signIn(page);
  const title = `detail paste ${Date.now()}`;
  await createIdea(page, title, "前後");
  await page.goto("/ideas");

  await page.locator(".idea-card").filter({ hasText: title }).locator(".idea-card__title").click();
  const dialog = page.locator("[data-idea-detail-dialog]");
  const body = dialog.locator("[data-idea-detail-body]");
  const editor = dialog.locator("[data-idea-body-editor]");
  await expect(editor).toBeVisible();

  await placeCaret(page, "[data-idea-detail-dialog] [data-idea-body-editor]", 1);
  await pasteImage(page, "[data-idea-detail-dialog] [data-idea-body-editor]");

  await expect(body).toHaveValue(/^前!\[\]\(\/api\/attachments\/[0-9A-Za-z_-]+\)後$/);
  // 画像は本文へ入るので添付欄は増えない。
  await expect(dialog.locator("[data-idea-attachment-id]")).toHaveCount(0);
  // 画像はその場に表示される（WYSIWYG）。
  await expect(editor.locator("img")).toHaveCount(1);

  await dialog.getByRole("button", { name: "閉じる" }).click();
  await page.reload();
  await expect(page.locator(".idea-card").filter({ hasText: title }).locator("img.idea-card__image")).toHaveAttribute(
    "src",
    /^\/api\/attachments\//,
  );
});

test("inserts a pasted screenshot at the caret of the idea composer body (BDD-TM-058)", async ({ page }) => {
  await signIn(page);
  const title = `composer paste ${Date.now()}`;
  await page.goto("/ideas");

  await page.locator("[data-idea-composer-trigger]").click();
  const composer = page.locator("[data-idea-composer]");
  await composer.getByLabel("メモのタイトル").fill(title);
  const body = composer.locator("[data-idea-composer-body]");
  const composerEditor = composer.locator("[data-idea-body-editor]");
  await composerEditor.fill("AB");
  await placeCaret(page, "[data-idea-composer] [data-idea-body-editor]", 1);
  await pasteImage(page, "[data-idea-composer] [data-idea-body-editor]");

  await expect(body).toHaveValue(/^A!\[\]\(pending-\d+-\d+\)B$/);
  // 貼り付けた画像は添付欄ではなく本文へ入る。
  await expect(composer.locator("[data-idea-composer-image]")).toHaveCount(0);

  await page.locator("[data-idea-composer-save]").click();
  await expect(page).toHaveURL(/\/ideas$/);

  const card = page.locator(".idea-card").filter({ hasText: title });
  await expect(card.locator("img.idea-card__image")).toHaveAttribute("src", /^\/api\/attachments\//);
  await expect(card.locator("[data-idea-attachment-id]")).toHaveCount(0);
});

test("inserts one image when the clipboard holds the same screenshot twice (BDD-TM-058)", async ({ page }) => {
  await signIn(page);
  const title = `detail dedupe ${Date.now()}`;
  await createIdea(page, title, "本文");
  await page.goto("/ideas");

  await page.locator(".idea-card").filter({ hasText: title }).locator(".idea-card__title").click();
  const body = page.locator("[data-idea-detail-body]");
  await expect(page.locator("[data-idea-detail-dialog] [data-idea-body-editor]")).toBeVisible();

  await placeCaret(page, "[data-idea-detail-dialog] [data-idea-body-editor]", 0);
  await pasteImage(page, "[data-idea-detail-dialog] [data-idea-body-editor]", true);

  await expect(body).toHaveValue(/^!\[\]\(\/api\/attachments\/[0-9A-Za-z_-]+\)本文$/);
  const tokens = (await body.inputValue()).match(/!\[\]\(/g) ?? [];
  expect(tokens).toHaveLength(1);
});

test("drops a pasted non-image file on the attachment list (BDD-TM-058)", async ({ page }) => {
  await signIn(page);
  const title = `detail file ${Date.now()}`;
  await createIdea(page, title, "本文");
  await page.goto("/ideas");

  await page.locator(".idea-card").filter({ hasText: title }).locator(".idea-card__title").click();
  const dialog = page.locator("[data-idea-detail-dialog]");
  await expect(dialog.locator("[data-idea-body-editor]")).toBeVisible();

  await placeCaret(page, "[data-idea-detail-dialog] [data-idea-body-editor]", 2);
  await page.locator("[data-idea-detail-dialog] [data-idea-body-editor]").evaluate((element) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(["hello"], "note.txt", { type: "text/plain" }));
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: transfer });
    element.dispatchEvent(event);
  });

  await expect(dialog.locator("[data-idea-attachment-id]")).toHaveCount(1);
  await expect(dialog.locator("[data-idea-detail-body]")).toHaveValue("本文");
});
