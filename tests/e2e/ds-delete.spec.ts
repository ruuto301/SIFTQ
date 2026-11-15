import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

/** Creates a task from the DS composer so the delete tests do not depend on other specs. */
async function createTask(page: Page, title: string) {
  await page.goto("/ds");
  await page.selectOption("#ds-new-project", "Yoriwake");
  await page.fill("#ds-new-title", title);
  await page.click("#ds-new-add");
  await expect(page.locator(".ds__task-title").filter({ hasText: title })).toHaveCount(1);
}

async function openDeleteDialog(page: Page, title: string) {
  const row = page.locator(".ds__task-item").filter({ hasText: title });
  await row.click({ button: "right" });
  await page.locator('[data-ds-task-action="delete"]').click();
  await expect(page.locator(".matrix-modal")).toBeVisible();
}

test("opens the delete confirmation in the middle of the viewport (BDD-TM-033)", async ({ page }) => {
  const title = `delete dialog ${Date.now()}`;
  await createTask(page, title);
  await openDeleteDialog(page, title);

  await expect(page.locator(".matrix-modal-text")).toHaveText("このタスクを削除しますか？");

  const frame = await page.evaluate(() => {
    const dialog = document.querySelector(".matrix-modal");
    const backdrop = document.querySelector(".matrix-modal-backdrop");
    if (dialog === null || backdrop === null) return null;
    const box = dialog.getBoundingClientRect();
    return {
      offsetX: Math.abs(box.left + box.width / 2 - window.innerWidth / 2),
      offsetY: Math.abs(box.top + box.height / 2 - window.innerHeight / 2),
      backdropPosition: getComputedStyle(backdrop).position,
      width: Math.round(box.width),
      height: Math.round(box.height),
    };
  });

  expect(frame).not.toBeNull();
  // Centered by the shared modal CSS, not by the browser's own confirm placement.
  expect(frame?.offsetX).toBeLessThanOrEqual(2);
  expect(frame?.offsetY).toBeLessThanOrEqual(2);
  expect(frame?.backdropPosition).toBe("fixed");
  expect(frame?.width).toBe(320);
  expect(frame?.height).toBe(160);
});

test("keeps the task when the confirmation is cancelled (BDD-TM-033)", async ({ page }) => {
  const title = `delete cancel ${Date.now()}`;
  await createTask(page, title);
  await openDeleteDialog(page, title);

  await page.locator(".matrix-modal-button--cancel").click();
  await expect(page.locator(".matrix-modal")).toHaveCount(0);
  await expect(page.locator(".ds__task-title").filter({ hasText: title })).toHaveCount(1);

  await openDeleteDialog(page, title);
  await page.keyboard.press("Escape");
  await expect(page.locator(".matrix-modal")).toHaveCount(0);
  await expect(page.locator(".ds__task-title").filter({ hasText: title })).toHaveCount(1);
});

test("deletes the task when the confirmation is accepted (BDD-TM-033)", async ({ page }) => {
  const title = `delete accept ${Date.now()}`;
  await createTask(page, title);
  await openDeleteDialog(page, title);

  await page.locator(".matrix-modal-button--danger").click();
  await expect(page.locator(".matrix-modal")).toHaveCount(0);
  await expect(page.locator(".ds__task-title").filter({ hasText: title })).toHaveCount(0);
});
