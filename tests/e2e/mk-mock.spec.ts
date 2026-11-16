import { expect, test } from "./fixtures";
import { signIn } from "./task-helpers";

test("shows the seven colors, the new memo button and the agreed wording (BDD-TM-037)", async ({ page }) => {
  await signIn(page);
  await page.goto("/mk");

  // The colour filters live in the "絞り込み" menu that opens next to the search.
  await page.locator("[data-mk-filter-menu] summary").click();
  await expect(page.locator("[data-mk-color-filter]")).toHaveCount(7);
  await expect(page.locator('[data-mk-color-filter="all"]')).toHaveCount(0);

  await expect(page.locator("[data-mk-search-input]")).toHaveAttribute(
    "placeholder",
    "メモを検索（タイトル / 本文）",
  );

  // Close the menu so its panel does not cover the composer.
  await page.locator("[data-mk-filter-menu] summary").click();

  // Keep's single "take a note" card opens the composer and focuses the title.
  await page.locator("[data-mk-composer-trigger]").click();
  await expect(page.locator("[data-mk-composer-editor]")).toBeVisible();
  await expect(page.locator("[data-mk-composer]").getByLabel("メモのタイトル")).toBeFocused();
  await expect(page.getByPlaceholder("新しいメモのタイトル")).toBeVisible();
  await expect(page.getByPlaceholder("本文。Ctrl+V で画像を貼り付けできます。")).toBeVisible();
  await expect(page.getByText("📋 Ctrl+V で画像を貼り付け")).toBeVisible();
});

test("clears the color filter when the active color is pressed again (BDD-TM-037)", async ({ page }) => {
  await signIn(page);
  await page.goto("/mk");

  await page.locator("[data-mk-filter-menu] summary").click();
  await page.locator('[data-mk-color-filter="red"]').click();
  await expect(page).toHaveURL(/[?&]color=red/);

  await page.locator("[data-mk-filter-menu] summary").click();
  await page.locator('[data-mk-color-filter="red"]').click();
  await expect(page).not.toHaveURL(/[?&]color=red/);
  await expect(page.locator("[data-mk-color-filter]")).toHaveCount(7);
});

test("clears the search from the × control (BDD-TM-037)", async ({ page }) => {
  await signIn(page);
  await page.goto("/mk?q=zzz");

  await page.locator("[data-mk-search-clear]").click();
  await expect(page).not.toHaveURL(/[?&]q=/);
  await expect(page.locator("[data-mk-search-input]")).toHaveAttribute(
    "placeholder",
    "メモを検索（タイトル / 本文）",
  );
});

test("has no bulk selection and a full-width search (BDD-TM-045)", async ({ page }) => {
  await signIn(page);
  await page.goto("/mk");

  await expect(page.locator("[data-mk-selection-toggle]")).toHaveCount(0);
  await expect(page.locator("[data-mk-bulk-bar]")).toHaveCount(0);

  // The search pill takes the toolbar width, so the box is much wider than its old 200px.
  const search = await page.locator("[data-mk-search-input]").boundingBox();
  const toolbar = await page.locator(".mk-toolbar").boundingBox();
  if (search === null || toolbar === null) throw new Error("the toolbar is missing");
  expect(search.width).toBeGreaterThan(toolbar.width * 0.5);
});

test("has no label controls (BDD-TM-047)", async ({ page }) => {
  await signIn(page);
  await page.goto("/mk");

  for (const selector of [
    "[data-mk-label-manager]",
    "[data-mk-card-label]",
    "[data-mk-composer-labels]",
    "[data-mk-label-create-input]",
  ]) {
    await expect(page.locator(selector)).toHaveCount(0);
  }
  await expect(page.getByText("新しいラベル")).toHaveCount(0);
});

test("caps the content width and wraps the cards (BDD-TM-050)", async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/mk");

  const pageBox = await page.locator(".page--mk").boundingBox();
  if (pageBox === null) throw new Error("the page is missing");
  expect(pageBox.width).toBeLessThanOrEqual(1400);

  const columnsAt = async (width: number) => {
    await page.setViewportSize({ width, height: 1080 });
    return page.locator(".mk-grid").evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  };
  expect(await columnsAt(1920)).toBe(4);
  expect(await columnsAt(1024)).toBe(3);
});
