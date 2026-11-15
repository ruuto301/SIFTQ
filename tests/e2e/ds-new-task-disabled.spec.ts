import { expect, test } from "./fixtures";

test("keeps the add button label visible while the composer is empty", async ({ page }) => {
  await page.goto("/ds");
  const input = page.locator("#ds-new-title");
  const add = page.locator("#ds-new-add");
  await expect(add).toBeDisabled();

  const disabled = await add.evaluate((element) => {
    const style = getComputedStyle(element);
    return { color: style.color, background: style.backgroundColor };
  });
  expect(disabled.color).toBe("rgb(138, 138, 138)");
  expect(disabled.background).toBe("rgb(232, 232, 232)");

  await input.fill("ラベルの確認");
  await expect(add).toBeEnabled();
  const enabled = await add.evaluate((element) => {
    const style = getComputedStyle(element);
    return { color: style.color, background: style.backgroundColor };
  });
  expect(enabled.color).toBe("rgb(220, 220, 220)");
  expect(enabled.background).toBe("rgb(38, 38, 38)");
});
