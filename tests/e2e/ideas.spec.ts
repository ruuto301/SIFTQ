import { expect, test } from "./fixtures";
import { signIn } from "./task-helpers";
import type { Page } from "@playwright/test";

/**
 * Ideas saves through the API and then reloads the page itself.
 * Waiting for that reload keeps the next click from racing with the navigation.
 */
async function actAndWaitForReload(page: Page, action: () => Promise<void>) {
  await Promise.all([page.waitForEvent("load"), action()]);
}

test("creates, pins, searches, bulk recolors, and deletes an Ideas note", async ({ page }) => {
  await signIn(page);
  await page.goto("/ideas");
  await expect(page.getByRole("heading", { name: "Ideas", exact: true })).toBeVisible();

  const title = `Ideas e2e ${Date.now()}`;
  await page.locator("[data-idea-composer-trigger]").click();
  await page.locator("[data-idea-composer]").getByLabel("メモのタイトル").fill(title);
  await page.locator("[data-idea-composer]").getByLabel("メモの本文").fill("e2e body");
  await page.locator('[data-idea-composer-color="blue"]').click();
  await actAndWaitForReload(page, () => page.locator("[data-idea-composer-save]").click());

  const card = page.locator(".idea-card").filter({ hasText: title });
  await expect(card).toHaveCount(1);
  await expect(card).toHaveAttribute("data-idea-color", "blue");
  await expect(card.locator(".idea-card__body")).toHaveText("e2e body");

  await card.hover();
  await actAndWaitForReload(page, () => card.locator("[data-idea-pin]").click());
  await expect(page.locator(".idea-card").filter({ hasText: title })).toHaveAttribute("data-idea-pinned", "true");

  await page.getByLabel("メモを検索").fill(title);
  await page.getByLabel("メモを検索").press("Enter");
  await expect(page).toHaveURL(/[?&]q=/);
  await expect(page.locator(".idea-card")).toHaveCount(1);
  await expect(page.locator(".idea-card").filter({ hasText: title })).toBeVisible();

  await page.goto("/ideas");
  await page.locator(".idea-card").filter({ hasText: title }).click();
  await page.locator(".idea-detail__more summary").click();
  await page.locator("[data-idea-detail-delete]").click();
  await expect(page.locator(".matrix-modal")).toContainText("このメモを削除しますか？");
  await actAndWaitForReload(page, () => page.locator(".matrix-modal-button--danger").click());
  await expect(page.locator(".idea-card").filter({ hasText: title })).toHaveCount(0);
});

test("uses the real note colors in the palette and keeps the card actions minimal (BDD-TM-054)", async ({ page }) => {
  await signIn(page);
  await page.goto("/ideas");

  const pairs = ["default", "red", "orange", "yellow", "green", "blue", "purple"];
  const cardColors = await page.evaluate((colors) => {
    const measure = (selector: string) => {
      const target = document.querySelector(selector);
      if (target === null) throw new Error("missing element: " + selector);
      const probe = document.createElement("div");
      probe.style.background = getComputedStyle(target).background;
      document.body.appendChild(probe);
      const value = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return value;
    };
    const card = document.createElement("article");
    card.className = "idea-card";
    document.body.appendChild(card);
    const result: Record<string, string> = {};
    for (const color of colors) {
      card.className = "idea-card idea-card--" + color;
      result[color] = measure(".idea-card--" + color);
    }
    card.remove();
    return result;
  }, pairs);

  const swatches = await page.evaluate((colors) => {
    const holder = document.createElement("div");
    holder.className = "idea-detail__swatches";
    document.body.appendChild(holder);
    const result: Record<string, string> = {};
    for (const color of colors) {
      const button = document.createElement("button");
      button.className = "idea-swatch idea-swatch--" + color;
      holder.appendChild(button);
      result[color] = getComputedStyle(button).backgroundColor;
    }
    holder.remove();
    return result;
  }, pairs);

  expect(swatches).toEqual(cardColors);

  // カードの操作はピンのみで、ピン中は常時表示される。
  await page.locator("[data-idea-composer-trigger]").click();
  const title = `Ideas pin ${Date.now()}`;
  await page.locator("[data-idea-composer]").getByLabel("メモのタイトル").fill(title);
  await actAndWaitForReload(page, () => page.locator("[data-idea-composer-save]").click());

  const card = page.locator(".idea-card").filter({ hasText: title });
  await expect(card.locator("[data-idea-pin]")).toHaveCount(1);
  await expect(card.locator("[data-idea-delete]")).toHaveCount(0);
  await expect(card.locator("[data-idea-preview-fetch]")).toHaveCount(0);
  await expect(card.locator(".idea-card__pin-badge")).toHaveCount(0);
  await expect(card.locator(".idea-card__actions")).toBeHidden();

  await card.hover();
  await actAndWaitForReload(page, () => card.locator("[data-idea-pin]").click());
  await expect(page.locator(".idea-card").filter({ hasText: title }).locator(".idea-card__actions")).toBeVisible();
});

test("keeps the detail bar minimal and auto-fetches a missing preview (BDD-TM-054)", async ({ page }) => {
  await signIn(page);
  await page.goto("/ideas");

  const title = `Ideas preview ${Date.now()}`;
  await page.locator("[data-idea-composer-trigger]").click();
  await page.locator("[data-idea-composer]").getByLabel("メモのタイトル").fill(title);
  await page.locator("[data-idea-composer]").getByLabel("メモの本文").fill("https://example.com/article");
  await actAndWaitForReload(page, () => page.locator("[data-idea-composer-save]").click());

  const card = page.locator(".idea-card").filter({ hasText: title });
  await expect(card.locator("[data-idea-preview]")).toHaveCount(0);

  await page.route("**/api/ideas/notes/*/preview", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "stub",
        title,
        body: "https://example.com/article",
        preview_title: "Example post",
        preview_description: "説明",
        preview_image: null,
      }),
    }),
  );

  await card.click();
  const bar = page.locator(".idea-detail__bar");
  await expect(bar.locator("[data-idea-detail-close]")).toBeVisible();
  await expect(bar.locator("[data-idea-detail-palette]")).toBeVisible();
  await expect(bar.locator("[data-idea-detail-archive]")).toBeHidden();
  await bar.locator("summary").click();
  await expect(bar.locator("[data-idea-detail-archive]")).toBeVisible();

  await expect(page.locator(".idea-card").filter({ hasText: title }).locator("[data-idea-preview]")).toContainText(
    "Example post",
  );
});
