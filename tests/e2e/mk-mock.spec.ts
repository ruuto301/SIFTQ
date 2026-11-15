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
  await expect(page.locator("[data-mk-selection-toggle]")).toHaveText("☑ 選択");

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
