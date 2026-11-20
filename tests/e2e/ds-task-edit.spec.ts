import { expect, test } from "./fixtures";
import { descriptionEditor, waitForPageSettle } from "./task-helpers";
import type { Page } from "@playwright/test";

async function createTask(page: Page, title: string, description: string) {
  await page.goto("/tasks");
  await page.getByRole("link", { name: "New task" }).click();
  await page.getByLabel("Title").fill(title);
  await descriptionEditor(page).fill(description);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
}

async function openTaskInDs(page: Page, title: string) {
  await page.goto("/ds");
  await page.locator(".ds__task").filter({ hasText: title }).click();
  await expect(page.locator("#ds-task-title")).toHaveValue(title);
  // The DS pane is server-rendered; wait for the deferred scripts that wire the
  // save, revert and tab handlers before interacting.
  await waitForPageSettle(page);
}

test("saves the title with Ctrl + Enter and autosaves it after typing stops (BDD-TM-036)", async ({ page }) => {
  const title = `ds edit ${Date.now()}`;
  const description = "最初の説明";
  await createTask(page, title, description);
  await openTaskInDs(page, title);

  await expect(page.locator("#ds-task-description")).toHaveValue(description);

  const updatedTitle = `${title} 更新`;
  const updatedDescription = "更新した説明\n- 追記";
  // A stored description opens on プレビュー, so switch to 編集 before typing.
  await page.getByRole("tab", { name: "編集" }).click();
  await page.locator("#ds-description-editor").fill(updatedDescription);
  await expect(page.locator("#ds-task-status")).toHaveText("保存しました");

  await page.locator("#ds-task-title").fill(updatedTitle);
  await page.locator("#ds-task-title").press("Control+Enter");
  await expect(page.locator("#ds-task-status")).toHaveText("保存しました");

  // The left pane card follows the save without a page reload.
  await expect(page.locator(".ds__task").filter({ hasText: updatedTitle })).toHaveCount(1);

  // The change is persisted.
  await page.reload();
  await expect(page.locator("#ds-task-title")).toHaveValue(updatedTitle);
  await expect(page.locator("#ds-task-description")).toHaveValue(updatedDescription);
});

test("autosaves the title after typing stops (BDD-TM-036)", async ({ page }) => {
  const title = `ds title autosave ${Date.now()}`;
  await createTask(page, title, "説明");
  await openTaskInDs(page, title);

  const updatedTitle = `${title} 停止後`;
  await page.locator("#ds-task-title").fill(updatedTitle);
  await expect(page.locator("#ds-task-status")).toHaveText("保存しました", { timeout: 3000 });
  await expect(page.locator(".ds__task").filter({ hasText: updatedTitle })).toHaveCount(1);

  await page.reload();
  await expect(page.locator("#ds-task-title")).toHaveValue(updatedTitle);
});

test("shows the saving state without sending overlapping requests (BDD-TM-036)", async ({ page }) => {
  const title = `ds autosave ${Date.now()}`;
  await createTask(page, title, "自動保存の説明");
  await openTaskInDs(page, title);
  await page.getByRole("tab", { name: "編集" }).click();

  let inFlight = 0;
  let maxInFlight = 0;
  const patches: string[] = [];
  await page.route("**/api/tasks/*", async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.continue();
      return;
    }
    patches.push(route.request().postData() ?? "");
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    // Outlast the 600ms autosave debounce so a second edit queues behind this request.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    inFlight -= 1;
    await route.continue();
  });

  const editor = page.locator("#ds-description-editor");
  await editor.fill("1 回目");
  await expect(page.locator("#ds-task-status")).toHaveText("保存中…");
  // Type again while the first request is in flight: the last text wins.
  await editor.fill("2 回目");
  await expect(page.locator("#ds-task-status")).toHaveText("保存しました");
  expect(maxInFlight).toBe(1);
  expect(patches.at(-1)).toContain("2 回目");

  await page.unroute("**/api/tasks/*");
  await page.reload();
  await expect(page.locator("#ds-task-description")).toHaveValue("2 回目");
});

test("keeps the input when the autosave fails (BDD-TM-036)", async ({ page }) => {
  const title = `ds autosave failure ${Date.now()}`;
  await createTask(page, title, "失敗する説明");
  await openTaskInDs(page, title);
  await page.getByRole("tab", { name: "編集" }).click();

  await page.route("**/api/tasks/*", (route) =>
    route.request().method() === "PATCH" ? route.fulfill({ status: 500, body: "" }) : route.continue(),
  );

  const editor = page.locator("#ds-description-editor");
  await editor.fill("失敗しても残る");
  await expect(page.locator("#ds-task-status")).toHaveText("保存できませんでした");
  await expect(page.locator("#ds-task-description")).toHaveValue("失敗しても残る");

  await page.unroute("**/api/tasks/*");
  await editor.fill("失敗しても残る 2");
  await expect(page.locator("#ds-task-status")).toHaveText("保存しました");
  await page.reload();
  await expect(page.locator("#ds-task-description")).toHaveValue("失敗しても残る 2");
});

test("saves with Ctrl + Enter and reverts with Escape (BDD-TM-036)", async ({ page }) => {
  const title = `ds keys ${Date.now()}`;
  await createTask(page, title, "キー操作の説明");
  await openTaskInDs(page, title);

  const patches: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "PATCH" && request.url().includes("/api/tasks/")) patches.push(request.url());
  });
  await page.clock.install();

  await page.locator("#ds-task-title").fill(`${title} 変更`);
  await page.locator("#ds-task-title").press("Escape");
  await expect(page.locator("#ds-task-title")).toHaveValue(title);
  await expect(page.locator("#ds-task-status")).toHaveText("");
  // Past the 600ms autosave debounce: Escape cancels the pending save.
  await page.clock.fastForward(1000);
  expect(patches).toEqual([]);

  await page.clock.resume();
  const saved = `${title} 保存`;
  await page.locator("#ds-task-title").fill(saved);
  await page.locator("#ds-task-title").press("Control+Enter");
  await expect(page.locator("#ds-task-status")).toHaveText("保存しました");
  await page.reload();
  await expect(page.locator("#ds-task-title")).toHaveValue(saved);
});

test("rejects an empty title (BDD-TM-036)", async ({ page }) => {
  const title = `ds empty ${Date.now()}`;
  await createTask(page, title, "");
  await openTaskInDs(page, title);

  await page.locator("#ds-task-title").fill("   ");
  await page.locator("#ds-task-title").press("Control+Enter");

  await expect(page.locator("#ds-task-error")).toContainText("title を入力してください。");
});
