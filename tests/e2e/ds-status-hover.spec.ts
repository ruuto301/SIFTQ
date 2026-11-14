import { expect, test } from "./fixtures";

test("keeps the do, done and skip tab colors unchanged on hover", async ({ page }) => {
  await page.goto("/ds");
  const tabs = page.locator(".ds__status-tabs .button.small");
  await expect(tabs).toHaveCount(3);

  const colors: string[] = [];
  for (let index = 0; index < 3; index += 1) {
    const tab = tabs.nth(index);
    const before = await tab.evaluate((element) => getComputedStyle(element).backgroundColor);
    await tab.hover();
    const hovered = await tab.evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(hovered).toBe(before);
    colors.push(before);
    await page.mouse.move(4, 4);
  }

  expect(colors[0]).toBe("rgb(27, 31, 36)");
  expect(colors[1]).toBe("rgb(255, 255, 255)");
  expect(colors[2]).toBe("rgb(255, 255, 255)");
});
