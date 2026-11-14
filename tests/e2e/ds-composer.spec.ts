import { expect, test } from "./fixtures";
import { createTask } from "./task-helpers";
import type { Locator, Page } from "@playwright/test";

function group(page: Page, id: string): Locator {
  return page.locator(`.ds__group[data-ds-group-id="${id}"]`);
}

async function groupCount(page: Page, id: string): Promise<number> {
  return Number((await group(page, id).locator(".ds__group-count").innerText()).trim());
}

async function selectedProject(page: Page): Promise<string> {
  return page
    .locator(".ds__task.active")
    .evaluate((link) => link.closest(".ds__task-item")?.getAttribute("data-task-project") ?? "");
}

test("adds a task from the DS composer to the selected project (BDD-TM-027)", async ({ page }) => {
  const title = `composer task ${Date.now()}`;
  await page.goto("/ds");
  await expect(page.locator("#ds-new-task")).toBeVisible();

  const project = await selectedProject(page);
  await expect(page.locator("#ds-new-project")).toHaveValue(project);
  const before = await groupCount(page, project);
  await expect(page.locator("#ds-new-add")).toBeDisabled();

  await page.fill("#ds-new-title", title);
  await expect(page.locator("#ds-new-add")).toBeEnabled();
  const posted = page.waitForRequest(
    (request) => request.method() === "POST" && request.url().endsWith("/api/tasks"),
  );
  await page.click("#ds-new-add");

  const body = JSON.parse((await posted).postData() ?? "{}");
  expect(body.title).toBe(title);
  expect(body.status).toBe("do");
  expect(body.project).toBe(project === "" ? null : project);

  const row = group(page, project).locator(".ds__task-item").filter({ hasText: title });
  await expect(row).toHaveCount(1);
  await expect(page.locator("#ds-new-project")).toHaveValue(project);
  expect(await groupCount(page, project)).toBe(before + 1);
  await expect(page.locator("#ds-new-title")).toHaveValue("");

  // The composer keeps the chat of the previously selected task in place.
  await expect(page.locator(".ds__task.active")).not.toHaveCount(0);
});

test("creates a task with the active status and the chosen project (BDD-TM-027)", async ({ page }) => {
  const title = `skip composer task ${Date.now()}`;
  await page.goto("/ds?status=skip");
  await expect(page.locator("#ds-new-title")).toHaveAttribute("placeholder", "タスクを追加（skip）");

  await page.selectOption("#ds-new-project", "Yoriwake");
  await page.fill("#ds-new-title", title);
  const posted = page.waitForRequest(
    (request) => request.method() === "POST" && request.url().endsWith("/api/tasks"),
  );
  await page.click("#ds-new-add");

  const body = JSON.parse((await posted).postData() ?? "{}");
  expect(body.status).toBe("skip");
  expect(body.project).toBe("Yoriwake");

  const row = group(page, "Yoriwake").locator(".ds__task-item").filter({ hasText: title });
  await expect(row).toHaveCount(1);
  await expect(row).toHaveAttribute("data-task-status", "skip");
  await expect(row).toHaveAttribute("data-task-project", "Yoriwake");
});

test("adds an unassigned task to the 未分類 group (BDD-TM-027)", async ({ page }) => {
  const title = `none composer task ${Date.now()}`;
  await page.goto("/ds");
  await page.selectOption("#ds-new-project", "");
  await page.fill("#ds-new-title", title);
  await page.click("#ds-new-add");

  const row = group(page, "").locator(".ds__task-item").filter({ hasText: title });
  await expect(row).toHaveCount(1);
  await expect(row).toHaveAttribute("data-task-project", "");
});

test("keeps the task text and reports a failure (BDD-TM-027)", async ({ page }) => {
  const title = `failing composer task ${Date.now()}`;
  await page.goto("/ds");
  await page.route("**/api/tasks", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({ status: 500, contentType: "application/json", body: '{"code":"INTERNAL"}' })
      : route.continue(),
  );

  await page.fill("#ds-new-title", title);
  await page.click("#ds-new-add");

  await expect(page.locator("#ds-new-error")).toBeVisible();
  await expect(page.locator("#ds-new-error")).toHaveText("保存に失敗しました。もう一度お試しください。");
  await expect(page.locator("#ds-new-title")).toHaveValue(title);
  await expect(page.locator(".ds__task-item").filter({ hasText: title })).toHaveCount(0);
});

test("expands a collapsed group when a task is added to it (BDD-TM-027)", async ({ page }) => {
  const title = `collapsed composer task ${Date.now()}`;
  await page.goto("/tasks");
  await createTask(page, title, "customer_portal");
  await page.goto("/ds");

  const target = group(page, "customer_portal");
  await target.locator(".ds__group-head").click();
  await expect(target).toHaveAttribute("data-collapsed", "true");

  const added = `collapsed added ${Date.now()}`;
  await page.selectOption("#ds-new-project", "customer_portal");
  await page.fill("#ds-new-title", added);
  await page.click("#ds-new-add");

  await expect(target).toHaveAttribute("data-collapsed", "false");
  await expect(target.locator(".ds__task-item").filter({ hasText: added })).toHaveCount(1);
});
