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
    }, `shift select ${stamp}-${index}`);
    expect(status).toBe(201);
  }
}

async function selectionState(page: Page) {
  return page.evaluate(() => {
    const list = document.querySelector("[data-task-list]");
    const boxes = Array.from(list?.querySelectorAll<HTMLInputElement>("[data-task-select]") ?? []);
    const summary = document.querySelector<HTMLElement>("[data-task-selection-summary]");
    return {
      checked: boxes.filter((box) => box.checked).length,
      total: boxes.length,
      selectedRows: list?.querySelectorAll("[data-task-row].is-selected").length ?? 0,
      summary: summary?.textContent ?? "",
      summaryHidden: summary?.hidden ?? true,
    };
  });
}

async function openList(page: Page) {
  await signIn(page);
  await createTasks(page, 6);
  await page.goto("/tasks");
  const boxes = page.locator("[data-task-list] [data-task-select]");
  await expect(boxes.first()).toBeVisible();
  return boxes;
}

test("selects a contiguous range with shift + click (BDD-TM-042)", async ({ page }) => {
  const boxes = await openList(page);
  await boxes.nth(1).click();
  await boxes.nth(4).click({ modifiers: ["Shift"] });

  const state = await selectionState(page);
  expect(state.checked).toBe(4);
  expect(state.selectedRows).toBe(4);
  expect(state.summary).toBe(`4 of ${state.total} selected`);
  expect(state.summaryHidden).toBe(false);
});

test("extends the range upwards and clears it again (BDD-TM-042)", async ({ page }) => {
  const boxes = await openList(page);
  await boxes.nth(4).click();
  await boxes.nth(1).click({ modifiers: ["Shift"] });
  expect((await selectionState(page)).checked).toBe(4);

  await boxes.nth(2).click({ modifiers: ["Shift"] });
  const cleared = await selectionState(page);
  expect(cleared.checked).toBe(2);
  expect(cleared.selectedRows).toBe(2);
});

test("starts a fresh range after select all (BDD-TM-042)", async ({ page }) => {
  const boxes = await openList(page);
  const selectAll = page.locator("[data-task-list] [data-task-select-all]");

  await selectAll.click();
  const all = await selectionState(page);
  expect(all.checked).toBe(all.total);

  await selectAll.click();
  expect((await selectionState(page)).checked).toBe(0);

  // The first shift + click after a reset behaves like a plain toggle.
  await boxes.nth(3).click({ modifiers: ["Shift"] });
  expect((await selectionState(page)).checked).toBe(1);

  await boxes.nth(5).click({ modifiers: ["Shift"] });
  const range = await selectionState(page);
  expect(range.checked).toBe(3);
  expect(range.selectedRows).toBe(3);
});
