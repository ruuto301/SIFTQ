import type { Page } from "@playwright/test";
import { signIn, descriptionEditor, createTask, openTaskFromList } from "./task-helpers";
import { expect, test } from "./fixtures";

async function changeStatus(page: Page, status: "done" | "skip") {
  await page.getByRole("link", { name: /^Status/ }).click();
  await expect(page.locator('[aria-label="Apply status to this task"]')).toBeVisible();
  await page
    .locator('[aria-label="Apply status to this task"] .status-choice', { hasText: status })
    .click();
  await expect(page.locator(`#task-meta .status--${status}`)).toHaveText(status);
  await expect(page.getByLabel("Title")).toBeEditable();
}

test("description update then Status operation stays interactive", async ({ page }) => {
  const title = `E2E 477 description ${Date.now()}`;
  await signIn(page);
  await createTask(page, title);
  await openTaskFromList(page, title, "do");
  await descriptionEditor(page).fill(`updated description ${Date.now()}`);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
  await openTaskFromList(page, title, "do");
  await changeStatus(page, "done");
});

test("title update then Status operation stays interactive", async ({ page }) => {
  const title = `E2E 477 title ${Date.now()}`;
  const updatedTitle = `${title} updated`;
  await signIn(page);
  await createTask(page, title);
  await openTaskFromList(page, title, "do");
  await page.getByLabel("Title").fill(updatedTitle);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
  await openTaskFromList(page, updatedTitle, "do");
  await changeStatus(page, "done");
});

test("project update then Status operation stays interactive", async ({ page }) => {
  const title = `E2E 477 project ${Date.now()}`;
  await signIn(page);
  await createTask(page, title);
  await openTaskFromList(page, title, "do");
  await page.getByLabel("Project").selectOption("dsh");
  await expect(page.getByLabel("Project")).toHaveValue("dsh");
  await changeStatus(page, "skip");
});

test("description selection left idle does not freeze Status", async ({ page }) => {
  const title = `E2E 477 selection ${Date.now()}`;
  const description = `selected description ${Date.now()}`;
  await signIn(page);
  await createTask(page, title);
  await openTaskFromList(page, title, "do");
  await descriptionEditor(page).fill(description);

  const editor = descriptionEditor(page);
  await editor.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    if (!selection) throw new Error("Selection is unavailable");
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await expect.poll(() => page.evaluate(() => window.getSelection()?.rangeCount ?? 0)).toBe(1);
  await changeStatus(page, "done");
  await expect(editor).toHaveText(description);
});
