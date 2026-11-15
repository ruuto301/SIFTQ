import { expect, test } from "./fixtures";
import { createTask, signIn } from "./task-helpers";

test("shows a task created from the task list at the top of its DS group (BDD-TM-039)", async ({ page }) => {
  await signIn(page);

  // Two tasks in the same project so the new one has something to move past.
  const older = `older ${Date.now()}`;
  await createTask(page, older, "affiliate");
  const newest = `newest ${Date.now()}`;
  await createTask(page, newest, "affiliate");

  await page.goto("/ds?status=do");
  const group = page.locator('.ds__group[data-ds-group-id="affiliate"]');
  await expect(group).toHaveCount(1);

  // The suite shares one database, so other tasks may already sit in the group.
  const titles = group.locator(".ds__task-title");
  await expect(titles.first()).toHaveText(newest);
  const texts = await titles.allTextContents();
  expect(texts.indexOf(older)).toBeGreaterThan(0);
});

test("puts the first task of an empty project at the top (BDD-TM-039)", async ({ page }) => {
  await signIn(page);

  const title = `only ${Date.now()}`;
  await createTask(page, title, "customer_portal");

  await page.goto("/ds?status=do");
  const group = page.locator('.ds__group[data-ds-group-id="customer_portal"]');
  await expect(group.locator(".ds__task-title").first()).toHaveText(title);
});
