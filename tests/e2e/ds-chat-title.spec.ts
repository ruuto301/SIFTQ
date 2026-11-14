import { expect, test } from "./fixtures";
import { createTask } from "./task-helpers";

test("shows the selected task title above the chat (BDD-TM-027)", async ({ page }) => {
  const title = `chat title ${Date.now()} ${"長いタイトル".repeat(20)}`;
  await page.goto("/tasks");
  await createTask(page, title, "Yoriwake");
  await page.goto("/ds");

  await page.locator(".ds__task-item", { hasText: title }).locator(".ds__task").click();

  const strip = page.locator(".ds__chat-title");
  await expect(strip).toBeVisible();
  await expect(page.locator(".ds__chat-title__label")).toHaveCount(0);
  const text = strip.locator(".ds__chat-title__text");
  await expect(text).toHaveText(title);
  const style = await text.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { whiteSpace: computed.whiteSpace, textOverflow: computed.textOverflow, overflowWrap: computed.overflowWrap };
  });
  expect(style.whiteSpace).toBe("normal");
  expect(style.textOverflow).not.toBe("ellipsis");
  expect(style.overflowWrap).toBe("anywhere");
  const height = await text.evaluate((element) => element.getBoundingClientRect().height);
  expect(height).toBeGreaterThan(24);
});
