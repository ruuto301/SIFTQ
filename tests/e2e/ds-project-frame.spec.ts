import { expect, test } from "./fixtures";
import type { Locator, Page } from "@playwright/test";

function group(page: Page, id: string): Locator {
  return page.locator(`.ds__group[data-ds-group-id="${id}"]`);
}

function otherGroups(page: Page, id: string): Locator {
  return page.locator(`.ds__group:not([data-ds-group-id="${id}"])`);
}

async function frameHeight(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  return Math.round(box?.height ?? 0);
}

async function frameHeights(locator: Locator): Promise<number[]> {
  return locator.evaluateAll((groups) => groups.map((element) => Math.round(element.getBoundingClientRect().height)));
}

test("frames each project so the header forms the top edge (BDD-TM-029)", async ({ page }) => {
  await page.goto("/ds");
  const first = page.locator(".ds__group").first();
  await expect(first).toBeVisible();

  const frame = await first.evaluate((element) => {
    const computed = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    const head = element.querySelector(".ds__group-head");
    const count = element.querySelector(".ds__group-count");
    return {
      border: `${computed.borderTopWidth} ${computed.borderTopStyle} ${computed.borderTopColor}`,
      radius: computed.borderRadius,
      overflow: computed.overflow,
      flexShrink: computed.flexShrink,
      boxWidth: Math.round(box.width),
      headWidth: head === null ? 0 : Math.round(head.getBoundingClientRect().width),
      headBackground: head === null ? "" : getComputedStyle(head).backgroundColor,
      countBackground: count === null ? "" : getComputedStyle(count).backgroundColor,
      countBorder: count === null ? "" : getComputedStyle(count).borderTopColor,
    };
  });

  expect(frame.border).toBe("2px solid rgb(0, 0, 0)");
  expect(frame.radius).toBe("8px");
  expect(frame.overflow).toBe("hidden");
  expect(frame.flexShrink).toBe("0");
  // The header is the inner top edge, so the 2px border sits outside it on both sides.
  expect(frame.boxWidth - frame.headWidth).toBe(4);
  expect(frame.headBackground).toBe("rgb(0, 0, 0)");
  expect(frame.countBackground).toBe("rgba(0, 0, 0, 0)");
  expect(frame.countBorder).toBe("rgb(139, 148, 158)");
});

test("extends the frame for an added task without squashing other projects (BDD-TM-029)", async ({ page }) => {
  const title = `frame task ${Date.now()}`;
  await page.goto("/ds");

  const target = group(page, "Yoriwake");
  const others = otherGroups(page, "Yoriwake");
  const cardsBefore = await target.locator(".ds__task-item").count();
  const before = await frameHeight(target);
  const othersBefore = await frameHeights(others);
  expect(othersBefore.length).toBeGreaterThan(0);

  await page.selectOption("#ds-new-project", "Yoriwake");
  await page.fill("#ds-new-title", title);
  await page.click("#ds-new-add");

  await expect(target.locator(".ds__task-item")).toHaveCount(cardsBefore + 1);
  const after = await frameHeight(target);
  expect(after).toBeGreaterThan(before);
  // The other projects keep their natural height instead of shrinking to fit.
  expect(await frameHeights(others)).toEqual(othersBefore);
});

test("shrinks the frame to the header when the project is collapsed (BDD-TM-029)", async ({ page }) => {
  await page.goto("/ds");
  const target = group(page, "Yoriwake");
  await expect(target.locator(".ds__task-item").first()).toBeVisible();

  const expanded = await frameHeight(target);
  const head = await frameHeight(target.locator(".ds__group-head"));

  await target.locator(".ds__group-head").click();
  await expect(target).toHaveAttribute("data-collapsed", "true");

  const collapsed = await frameHeight(target);
  expect(collapsed).toBeLessThan(expanded);
  // Only the 2px border around the header is left.
  expect(collapsed).toBe(head + 4);
});
