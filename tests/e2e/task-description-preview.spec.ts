import type { Page } from "@playwright/test";
import { signIn, descriptionEditor, createTask, openTaskFromList, waitForPageSettle } from "./task-helpers";
import { expect, test } from "./fixtures";

const MARKDOWN_DESCRIPTION = [
  "# Heading",
  "",
  "**bold value** and `code`",
  "",
  "- [ ] todo",
  "- [x] done",
  "",
  "| name | value |",
  "| --- | --- |",
  "| a | 1 |",
  "",
  "<script>alert(1)</script>",
].join("\n");

async function createTaskWithDescription(page: Page, title: string, description: string) {
  await page.getByRole("link", { name: "New task" }).click();
  await page.getByLabel("Title").waitFor();
  await waitForPageSettle(page);
  await page.getByLabel("Title").fill(title);
  await descriptionEditor(page).fill(description);
  await page.getByRole("button", { name: "Create" }).click();
}

test("previews a markdown description on the task detail screen", async ({ page }) => {
  const title = `E2E markdown detail ${Date.now()}`;

  await signIn(page);
  await createTaskWithDescription(page, title, MARKDOWN_DESCRIPTION);
  await openTaskFromList(page, title, "do");
  await waitForPageSettle(page);

  const preview = page.locator("[data-description-preview]");
  await expect(page.getByRole("tab", { name: "プレビュー" })).toHaveAttribute("aria-selected", "true");
  await expect(preview).toBeVisible();
  await expect(preview.locator("h1")).toHaveText("Heading");
  await expect(preview.locator("strong")).toHaveText("bold value");
  await expect(preview.locator("code")).toHaveText("code");
  await expect(preview.locator("li")).toHaveCount(2);
  await expect(preview.locator("table td").first()).toHaveText("a");
  await expect(preview).toContainText("<script>alert(1)</script>");
  await expect(preview.locator("script")).toHaveCount(0);
});

test("switches the description tabs with the arrow keys", async ({ page }) => {
  const title = `E2E markdown keyboard ${Date.now()}`;

  await signIn(page);
  await createTaskWithDescription(page, title, "**keyboard** preview");
  await openTaskFromList(page, title, "do");
  await waitForPageSettle(page);

  const editTab = page.getByRole("tab", { name: "編集" });
  const previewTab = page.getByRole("tab", { name: "プレビュー" });
  await expect(previewTab).toHaveAttribute("aria-selected", "true");

  await previewTab.press("ArrowLeft");
  await expect(editTab).toHaveAttribute("aria-selected", "true");
  await expect(descriptionEditor(page)).toBeVisible();

  await editTab.press("ArrowRight");
  await expect(previewTab).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("[data-description-preview] strong")).toHaveText("keyboard");
});

test("previews the edited description on the task detail screen", async ({ page }) => {
  const title = `E2E markdown edit ${Date.now()}`;

  await signIn(page);
  await createTask(page, title);
  await openTaskFromList(page, title, "do");
  await waitForPageSettle(page);

  await descriptionEditor(page).fill("~~removed~~ **kept**");
  await page.getByRole("tab", { name: "プレビュー" }).click();

  const preview = page.locator("[data-description-preview]");
  await expect(preview.locator("del")).toHaveText("removed");
  await expect(preview.locator("strong")).toHaveText("kept");
});

test("opens the editor when the task description is empty", async ({ page }) => {
  const title = `E2E markdown empty ${Date.now()}`;

  await signIn(page);
  await createTask(page, title);
  await openTaskFromList(page, title, "do");
  await waitForPageSettle(page);

  await expect(page.getByRole("tab", { name: "編集" })).toHaveAttribute("aria-selected", "true");
  await expect(descriptionEditor(page)).toBeVisible();
  await expect(page.locator("[data-description-preview]")).toBeHidden();
});

test("previews the description while creating a task", async ({ page }) => {
  const title = `E2E markdown form ${Date.now()}`;

  await signIn(page);
  await page.getByRole("link", { name: "New task" }).click();
  await page.getByLabel("Title").waitFor();
  await waitForPageSettle(page);
  await page.getByLabel("Title").fill(title);
  await descriptionEditor(page).fill("**form bold** and `form code`");
  await page.getByRole("tab", { name: "プレビュー" }).click();

  const preview = page.locator("[data-description-preview]");
  await expect(preview.locator("strong")).toHaveText("form bold");
  await expect(preview.locator("code")).toHaveText("form code");

  await page.getByRole("tab", { name: "編集" }).click();
  await expect(descriptionEditor(page)).toHaveText("**form bold** and `form code`");
});
