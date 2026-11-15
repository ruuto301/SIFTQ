import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

async function signIn(page: Page) {
  await page.goto("/ideas");
  await expect(page).toHaveURL(/\/ideas$/);
}

async function createTasks(page: Page, count: number): Promise<void> {
  const stamp = Date.now();
  for (let index = 0; index < count; index += 1) {
    const status = await page.evaluate(async (title) => {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, description: "" }),
      });
      return response.status;
    }, `checkbox target ${stamp}-${index}`);
    expect(status).toBe(201);
  }
}

test("keeps the selection controls easy to hit and aligned (BDD-TM-043)", async ({ page }) => {
  await signIn(page);
  await createTasks(page, 2);
  await page.goto("/tasks");
  await expect(page.locator("[data-task-row]").first()).toBeVisible();

  const metrics = await page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector(selector);
      if (element === null) return null;
      const box = element.getBoundingClientRect();
      return { x: box.x, right: box.right, width: box.width, height: box.height, center: box.x + box.width / 2 };
    };
    return {
      cell: rect(".task-row-selection"),
      input: rect(".task-row-selection input"),
      selectAll: rect(".task-select-all"),
      selectAllInput: rect(".task-select-all input"),
      title: rect(".task-row-title"),
    };
  });

  expect(metrics.cell?.width).toBeGreaterThanOrEqual(44);
  expect(metrics.cell?.height).toBeGreaterThanOrEqual(44);
  expect(metrics.selectAll?.width).toBeGreaterThanOrEqual(44);
  expect(metrics.selectAll?.height).toBeGreaterThanOrEqual(44);
  expect(metrics.input?.width).toBeGreaterThanOrEqual(24);
  expect(metrics.selectAllInput?.width).toBeGreaterThanOrEqual(24);
  expect(Math.abs((metrics.cell?.center ?? 0) - (metrics.selectAll?.center ?? 0))).toBeLessThanOrEqual(1);
  expect(metrics.title?.x ?? 0).toBeGreaterThanOrEqual(metrics.cell?.right ?? 0);
});

test("toggles the row selection from the row padding (BDD-TM-043)", async ({ page }) => {
  await signIn(page);
  await createTasks(page, 1);
  await page.goto("/tasks");

  const row = page.locator("[data-task-row]").first();
  await expect(row).toBeVisible();
  const box = await row.boundingBox();
  if (box === null) throw new Error("task row was not rendered");

  const paddingPoint = { x: box.x + box.width - 4, y: box.y + box.height / 2 };
  await page.mouse.click(paddingPoint.x, paddingPoint.y);
  await expect(row.locator("[data-task-select]")).toBeChecked();
  await expect(page.locator("[data-task-selection-summary]")).toHaveText(/^1 of \d+ selected$/);
  expect(page.url()).toContain("/tasks");

  await page.mouse.click(paddingPoint.x, paddingPoint.y);
  await expect(row.locator("[data-task-select]")).not.toBeChecked();
  await expect(page.locator("[data-task-selection-summary]")).toBeHidden();
});
