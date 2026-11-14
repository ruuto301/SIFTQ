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
  expect(disabled.color).toBe("rgb(139, 148, 158)");
  expect(disabled.background).toBe("rgb(255, 255, 255)");

  await input.fill("ラベルの確認");
  await expect(add).toBeEnabled();
  const enabled = await add.evaluate((element) => {
    const style = getComputedStyle(element);
    return { color: style.color, background: style.backgroundColor };
  });
  expect(enabled.color).toBe("rgb(255, 255, 255)");
  expect(enabled.background).toBe("rgb(27, 31, 36)");
});
