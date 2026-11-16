import { expect, test } from "./fixtures";
import { signIn } from "./task-helpers";

test("shows the seven colors, the new memo button and the agreed wording (BDD-TM-037)", async ({ page }) => {
  await signIn(page);
  await page.goto("/ideas");

  // The colour filters live in the "絞り込み" menu that opens next to the search.
  await page.locator("[data-idea-filter-menu] summary").click();
  await expect(page.locator("[data-idea-color-filter]")).toHaveCount(7);
  await expect(page.locator('[data-idea-color-filter="all"]')).toHaveCount(0);

  await expect(page.locator("[data-idea-search-input]")).toHaveAttribute(
    "placeholder",
    "メモを検索（タイトル / 本文）",
  );

  // Close the menu so its panel does not cover the composer.
  await page.locator("[data-idea-filter-menu] summary").click();

  // Keep's single "take a note" card opens the composer and focuses the title.
  await page.locator("[data-idea-composer-trigger]").click();
  await expect(page.locator("[data-idea-composer-editor]")).toBeVisible();
  await expect(page.locator("[data-idea-composer]").getByLabel("メモのタイトル")).toBeFocused();
  await expect(page.getByPlaceholder("新しいメモのタイトル")).toBeVisible();
  await expect(page.getByPlaceholder("本文。Ctrl+V で画像を貼り付けできます。")).toBeVisible();
  await expect(page.getByText("📋 Ctrl+V で画像を貼り付け")).toBeVisible();
});

test("clears the color filter when the active color is pressed again (BDD-TM-037)", async ({ page }) => {
  await signIn(page);
  await page.goto("/ideas");

  await page.locator("[data-idea-filter-menu] summary").click();
  await page.locator('[data-idea-color-filter="red"]').click();
  await expect(page).toHaveURL(/[?&]color=red/);

  await page.locator("[data-idea-filter-menu] summary").click();
  await page.locator('[data-idea-color-filter="red"]').click();
  await expect(page).not.toHaveURL(/[?&]color=red/);
  await expect(page.locator("[data-idea-color-filter]")).toHaveCount(7);
});

test("clears the search from the × control (BDD-TM-037)", async ({ page }) => {
  await signIn(page);
  await page.goto("/ideas?q=zzz");

  await page.locator("[data-idea-search-clear]").click();
  await expect(page).not.toHaveURL(/[?&]q=/);
  await expect(page.locator("[data-idea-search-input]")).toHaveAttribute(
    "placeholder",
    "メモを検索（タイトル / 本文）",
  );
});

test("has no bulk selection and a full-width search (BDD-TM-045)", async ({ page }) => {
  await signIn(page);
  await page.goto("/ideas");

  await expect(page.locator("[data-idea-selection-toggle]")).toHaveCount(0);
  await expect(page.locator("[data-idea-bulk-bar]")).toHaveCount(0);

  // The search pill takes the toolbar width, so the box is much wider than its old 200px.
  const search = await page.locator("[data-idea-search-input]").boundingBox();
  const toolbar = await page.locator(".idea-toolbar").boundingBox();
  if (search === null || toolbar === null) throw new Error("the toolbar is missing");
  expect(search.width).toBeGreaterThan(toolbar.width * 0.5);
});

test("has no label controls (BDD-TM-047)", async ({ page }) => {
  await signIn(page);
  await page.goto("/ideas");

  for (const selector of [
    "[data-idea-label-manager]",
    "[data-idea-card-label]",
    "[data-idea-composer-labels]",
    "[data-idea-label-create-input]",
  ]) {
    await expect(page.locator(selector)).toHaveCount(0);
  }
  await expect(page.getByText("新しいラベル")).toHaveCount(0);
});

test("caps the content width and wraps the cards (BDD-TM-050)", async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/ideas");

  const pageBox = await page.locator(".page--idea").boundingBox();
  if (pageBox === null) throw new Error("the page is missing");
  expect(pageBox.width).toBeLessThanOrEqual(1400);

  const columnsAt = async (width: number) => {
    await page.setViewportSize({ width, height: 1080 });
    return page.locator(".idea-grid").evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  };
  expect(await columnsAt(1920)).toBe(4);
  expect(await columnsAt(1024)).toBe(3);
});
