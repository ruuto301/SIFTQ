import { expect, test } from "./fixtures";
import { createTask } from "./task-helpers";

test("opens the English action menu on a DS task (BDD-TM-030)", async ({ page }) => {
  const title = `menu ${Date.now()}`;
  await page.goto("/tasks");
  await createTask(page, title, "Yoriwake");
  await page.goto("/ds");

  await page.locator(".ds__task-item", { hasText: title }).click({ button: "right" });
  const menu = page.locator(".matrix-menu");
  await expect(menu).toBeVisible();
  await expect(menu.locator(".ds-menu__title")).toHaveText(title);
  await expect(menu.locator(".ds-menu__meta")).toHaveText("do ・ Yoriwake");
  await expect(menu.locator(".ds-menu__chip")).toHaveText(["do", "done", "skip"]);
  await expect(menu.locator(".ds-menu__chip.is-active")).toHaveText("do");
  await expect(menu.locator(".ds-menu__row", { hasText: "project" })).toContainText("Yoriwake");
  await expect(menu.getByText("copy title", { exact: true })).toBeVisible();
  await expect(menu.locator(".ds-menu__row", { hasText: "working" })).toContainText("off");
  await expect(menu.getByText("delete", { exact: true })).toBeVisible();
  await expect(menu.getByText("タスク詳細を開く")).toHaveCount(0);
  await expect(menu.getByText("リンクをコピー")).toHaveCount(0);
});

test("opens the task menu at the pointer and flips inside the viewport", async ({ page }) => {
  await page.goto("/tasks");
  await createTask(page, `menu position ${Date.now()}`, "Yoriwake");
  await page.goto("/ds");

  const viewport = page.viewportSize();
  if (viewport === null) throw new Error("viewport is required");
  const row = page.locator(".ds__task-item").first();
  const rowBox = await row.boundingBox();
  if (rowBox === null) throw new Error("task row is required");

  await row.click({ button: "right", position: { x: 30, y: 12 } });
  const menu = page.locator(".matrix-menu");
  await expect(menu).toBeVisible();
  const opened = await menu.boundingBox();
  if (opened === null) throw new Error("menu is required");
  // 左上がカーソル位置（+1px）に開く
  expect(Math.abs(opened.x - (rowBox.x + 30) - 1)).toBeLessThanOrEqual(1);

  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);

  // 画面右下で開くと左・上へ反転して画面内に収まる
  await row.evaluate(
    (element, point) => {
      element.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: point.x,
          clientY: point.y,
        }),
      );
    },
    { x: viewport.width - 12, y: viewport.height - 12 },
  );
  const flipped = await menu.boundingBox();
  if (flipped === null) throw new Error("menu is required");
  expect(flipped.x + flipped.width).toBeLessThanOrEqual(viewport.width - 8 + 1);
  expect(flipped.y + flipped.height).toBeLessThanOrEqual(viewport.height - 8 + 1);
  expect(flipped.x).toBeLessThan(viewport.width - 12);
  expect(flipped.y).toBeLessThan(viewport.height - 12);
});

test("copies the task title and changes the status from the menu (BDD-TM-030)", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const title = `menu copy ${Date.now()}`;
  await page.goto("/tasks");
  await createTask(page, title, "Yoriwake");
  await page.goto("/ds");

  await page.locator(".ds__task-item", { hasText: title }).click({ button: "right" });
  await page.locator(".matrix-menu").getByText("copy title", { exact: true }).click();
  await expect(page.locator("#ds-groups-status")).toHaveText("copied");
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(title);

  await page.locator(".ds__task-item", { hasText: title }).click({ button: "right" });
  await page.locator(".matrix-menu .ds-menu__chip", { hasText: "done" }).click();
  await expect(page.locator(".ds__task-item", { hasText: title })).toHaveCount(0);
});
