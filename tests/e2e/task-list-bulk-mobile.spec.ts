import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const WIDTHS = [320, 360, 390, 412];

async function signIn(page: Page) {
  await page.goto("/ideas");
  await expect(page).toHaveURL(/\/ideas$/);
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test("keeps the mobile bulk-action buttons uniform at every width (Issue #810)", async ({ page }) => {
  await signIn(page);

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/tasks");
    await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const buttons = page.locator(".task-bulk-actions .button");
    await expect(buttons).toHaveCount(3);
    const metrics = await buttons.evaluateAll((nodes) =>
      nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return {
          height: box.height,
          left: box.x,
          right: box.right,
          // The fixed height and `nowrap` mean a wrapped label overflows the box
          // vertically, so a scroll mismatch exposes the two-line regression.
          overflowX: Math.max(0, node.scrollWidth - node.clientWidth),
          overflowY: Math.max(0, node.scrollHeight - node.clientHeight),
        };
      }),
    );
    for (const metric of metrics) {
      expect(metric.height).toBe(40);
      expect(metric.overflowX).toBe(0);
      expect(metric.overflowY).toBe(0);
      expect(metric.left).toBeGreaterThanOrEqual(0);
      expect(metric.right).toBeLessThanOrEqual(width);
    }
  }
});

test("aligns the bulk menus with their buttons and keeps them on screen (Issue #810)", async ({ page }) => {
  await signIn(page);

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/tasks");
    await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();

    // The first menu is "Mark as", the second is "Project".
    const menus = page.locator("details.task-bulk-menu");
    for (let index = 0; index < 2; index += 1) {
      const details = menus.nth(index);
      const summary = details.locator("summary");
      const items = details.locator(".task-bulk-menu-items");
      await summary.click();
      await expect(items).toBeVisible();

      const summaryBox = await summary.boundingBox();
      const menuBox = await items.boundingBox();
      if (summaryBox === null || menuBox === null) throw new Error("The bulk menu bounds are missing");
      expect(Math.abs(menuBox.x - summaryBox.x)).toBeLessThanOrEqual(1);
      expect(menuBox.x).toBeGreaterThanOrEqual(0);
      expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(width);
      await expectNoHorizontalOverflow(page);

      await summary.click();
      await expect(items).toBeHidden();
    }
  }
});

test("opens and closes the bulk menus from the keyboard (Issue #810)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto("/tasks");

  const summary = page.locator("details.task-bulk-menu summary").first();
  const items = page.locator("details.task-bulk-menu .task-bulk-menu-items").first();
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(items).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(items).toBeHidden();
});
