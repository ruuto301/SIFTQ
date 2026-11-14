import { expect, test } from "./fixtures";
import { createTask } from "./task-helpers";
import type { Locator, Page } from "@playwright/test";

declare global {
  interface Window {
    __dsDragOver: boolean[];
  }
}

/** Records whether each dragover was accepted, which is what removes the 🚫 cursor. */
async function watchDragOver(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__dsDragOver = [];
    document.addEventListener("dragover", (event) => {
      window.__dsDragOver.push(event.defaultPrevented);
    });
  });
}

async function draggedOver(page: Page): Promise<boolean[]> {
  return page.evaluate(() => window.__dsDragOver);
}

async function groupOrder(page: Page): Promise<(string | null)[]> {
  return page
    .locator(".ds__groups > .ds__group")
    .evaluateAll((groups) => groups.map((group) => group.getAttribute("data-ds-group-id")));
}

function group(page: Page, id: string): Locator {
  return page.locator(`.ds__group[data-ds-group-id="${id}"]`);
}

async function taskIds(page: Page, id: string): Promise<string[]> {
  return group(page, id)
    .locator(".ds__task-item")
    .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-task-id") ?? ""));
}

test("moves a task between project groups by drag and drop (BDD-TM-025)", async ({ page }) => {
  const title = `dnd task ${Date.now()}`;
  await page.goto("/tasks");
  await createTask(page, title, "Yoriwake");
  await page.goto("/ds");
  await watchDragOver(page);

  const source = group(page, "Yoriwake");
  const target = group(page, "affiliate");
  const row = source.locator(".ds__task-item").filter({ hasText: title });
  await expect(row).toHaveCount(1);
  const taskId = await row.getAttribute("data-task-id");
  expect(taskId).not.toBeNull();

  const moved = page.waitForRequest(
    (request) => request.method() === "PATCH" && request.url().includes("/api/tasks/bulk/project"),
  );
  await row.dragTo(target.locator(".ds__group-head"));
  const body = (await moved).postData() ?? "";
  expect(body).toContain('"project":"affiliate"');
  expect(body).toContain(`"id":"${taskId}"`);

  await expect(target.locator(`.ds__task-item[data-task-id="${taskId}"]`)).toHaveCount(1);
  const prevented = await draggedOver(page);
  expect(prevented.length).toBeGreaterThan(0);
  expect(prevented.every((value) => value)).toBe(true);
});

test("reorders project groups by drag and drop and keeps the order after reload (BDD-TM-025)", async ({ page }) => {
  await page.goto("/ds");
  const before = await groupOrder(page);
  const projects = before.filter((id): id is string => id !== null && id !== "");
  expect(projects.length).toBeGreaterThan(1);
  const anchor = projects[0] ?? "";
  const dragged = projects[1] ?? "";

  const reordered = page.waitForRequest(
    (request) => request.method() === "POST" && request.url().includes("/api/projects/reorder"),
  );
  await group(page, dragged).locator(".ds__group-head").dragTo(group(page, anchor).locator(".ds__group-head"));
  await reordered;

  const after = await groupOrder(page);
  expect(after[0]).toBe(dragged);
  await page.reload();
  expect(await groupOrder(page)).toEqual(after);
});

test("reorders tasks inside a project group by drag and drop (BDD-TM-026)", async ({ page }) => {
  const stamp = Date.now();
  await page.goto("/tasks");
  await createTask(page, `dnd order a ${stamp}`, "Yoriwake");
  await createTask(page, `dnd order b ${stamp}`, "Yoriwake");
  await page.goto("/ds");

  const before = await taskIds(page, "Yoriwake");
  expect(before.length).toBeGreaterThan(1);
  const dragged = before[before.length - 1] ?? "";
  const anchor = before[0] ?? "";
  expect(dragged).not.toBe("");
  expect(anchor).not.toBe("");

  const reordered = page.waitForRequest(
    (request) => request.method() === "POST" && request.url().includes("/api/tasks/reorder"),
  );
  await page
    .locator(`.ds__task-item[data-task-id="${dragged}"]`)
    .dragTo(page.locator(`.ds__task-item[data-task-id="${anchor}"]`), { targetPosition: { x: 8, y: 2 } });
  await reordered;

  const after = await taskIds(page, "Yoriwake");
  expect(after[0]).toBe(dragged);
  expect(after).toHaveLength(before.length);
  await page.reload();
  expect(await taskIds(page, "Yoriwake")).toEqual(after);
});
