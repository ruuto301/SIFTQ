import { expect, test } from "./fixtures";
import { createTask } from "./task-helpers";
import type { Locator, Page } from "@playwright/test";

/** Left-pane width in px, read from the CSS variable the resizer owns. */
async function paneWidth(page: Page): Promise<number> {
  const raw = await page
    .locator("#ds-root")
    .evaluate((root) => getComputedStyle(root).getPropertyValue("--ds-left"));
  return Number.parseFloat(raw);
}

async function expectPaneWidth(page: Page, expected: number): Promise<void> {
  await expect.poll(() => paneWidth(page)).toBe(expected);
}

/** Same free-range math the client script uses, from the live container width. */
async function maxPaneWidth(page: Page): Promise<number> {
  return page.locator("#ds-root").evaluate((root) => {
    const width = root.getBoundingClientRect().width;
    return Math.max(160, Math.min(Math.round(width * 0.75), Math.round(width - 360)));
  });
}

async function resizerBox(resizer: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await resizer.boundingBox();
  if (box === null) throw new Error("The DS resizer is not visible");
  return box;
}

test("keeps the DS page full width without a max-width cap", async ({ page }) => {
  await page.goto("/ds");
  const frame = page.locator(".ds-page");

  await expect(frame).toHaveCSS("max-width", "none");
  const spansParent = await frame.evaluate((element) => {
    const parent = element.parentElement;
    if (parent === null) return false;
    const frameWidth = element.getBoundingClientRect().width;
    return Math.abs(frameWidth - parent.getBoundingClientRect().width) <= 2;
  });
  expect(spansParent).toBe(true);
});

test("drags the resizer, shows the width tag and persists the width after reload", async ({ page }) => {
  const title = `ds drag ${Date.now()}`;
  await page.goto("/tasks");
  await createTask(page, title, "Yoriwake");
  await page.goto("/ds");
  await expectPaneWidth(page, 320);

  const resizer = page.locator(".ds__resizer");
  await expect(resizer).toHaveCSS("cursor", "col-resize");
  const box = await resizerBox(resizer);
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 120, startY, { steps: 5 });
  await expect(resizer).toHaveClass(/dragging/);
  await expect(page.locator(".ds__width-tag")).toHaveCSS("opacity", "1");
  await page.mouse.up();

  await expectPaneWidth(page, 440);
  await expect(resizer).toHaveAttribute("aria-valuenow", "440");

  await page.reload();
  await expectPaneWidth(page, 440);
});

test("resets with double-click and adjusts the width from the keyboard", async ({ page }) => {
  await page.goto("/ds");
  await expectPaneWidth(page, 320);
  const resizer = page.locator(".ds__resizer");

  await resizer.focus();
  await page.keyboard.press("ArrowRight");
  await expectPaneWidth(page, 328);

  await page.keyboard.press("Shift+ArrowRight");
  await expectPaneWidth(page, 352);

  await page.keyboard.press("Home");
  await expectPaneWidth(page, 160);
  await expect(resizer).toHaveAttribute("aria-valuenow", "160");
  await expect(resizer).toHaveAttribute("aria-valuemin", "160");

  const max = await maxPaneWidth(page);
  await page.keyboard.press("End");
  await expectPaneWidth(page, max);
  await expect(resizer).toHaveAttribute("aria-valuemax", String(max));

  await resizer.dblclick();
  await expectPaneWidth(page, 320);
});

test("falls back to one pane with a back control on a narrow viewport", async ({ page }) => {
  const title = `ds narrow ${Date.now()}`;
  await page.goto("/tasks");
  await createTask(page, title, "Yoriwake");

  await page.setViewportSize({ width: 800, height: 900 });
  await page.goto("/ds");

  const list = page.locator(".ds__pane--tasks");
  const detail = page.locator(".ds__pane--detail");
  await expect(page.locator(".ds__resizer")).toBeHidden();
  await expect(list).toBeVisible();
  await expect(detail).toBeHidden();

  await list.locator(".ds__task-item", { hasText: title }).locator(".ds__task").click();

  await expect(detail).toBeVisible();
  await expect(list).toBeHidden();
  const back = page.getByRole("button", { name: "一覧へ戻る" });
  await expect(back).toBeVisible();

  await back.click();
  await expect(list).toBeVisible();
  await expect(detail).toBeHidden();
});
