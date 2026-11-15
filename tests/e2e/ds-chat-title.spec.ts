import { expect, test } from "./fixtures";
import { createTask } from "./task-helpers";

test("shows the selected task title only in the task tab (BDD-TM-027)", async ({ page }) => {
  const title = `title once ${Date.now()}`;
  await page.goto("/tasks");
  await createTask(page, title, "Yoriwake");
  await page.goto("/ds");
  await page.locator(".ds__task-item", { hasText: title }).locator(".ds__task").click();

  await expect(page.locator("#ds-task-title")).toHaveValue(title);
  // The strip above the panes is gone, so the title is not printed twice.
  await expect(page.locator(".ds__chat-title")).toHaveCount(0);
});
