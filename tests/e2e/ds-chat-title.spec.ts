import { expect, test } from "./fixtures";
import { createTask } from "./task-helpers";

test("shows the selected task title above the chat (BDD-TM-027)", async ({ page }) => {
  const title = `chat title ${Date.now()}`;
  await page.goto("/tasks");
  await createTask(page, title, "Yoriwake");
  await page.goto("/ds");

  await page.locator(".ds__task-item", { hasText: title }).locator(".ds__task").click();

  const strip = page.locator(".ds__chat-title");
  await expect(strip).toBeVisible();
  const text = strip.locator(".ds__chat-title__text");
  await expect(text).toHaveText(title);
  await expect(text).toHaveAttribute("title", title);
});
