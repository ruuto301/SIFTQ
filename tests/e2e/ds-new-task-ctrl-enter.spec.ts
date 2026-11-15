import { expect, test } from "./fixtures";

test("adds a task with Ctrl + Enter from the DS composer", async ({ page }) => {
  await page.goto("/ds");
  const input = page.locator("#ds-new-title");
  const add = page.locator("#ds-new-add");
  await expect(input).toBeVisible();
  await expect(add).toHaveAttribute("title", "追加 (Ctrl + Enter)");
  await expect(input).toHaveAttribute("aria-keyshortcuts", "Control+Enter Meta+Enter");
  await expect(page.locator(".ds__new-hint")).toHaveText("Ctrl + Enter で追加");

  const title = `ctrl enter ${Date.now()}`;
  const created = page.waitForRequest(
    (request) => request.method() === "POST" && request.url().includes("/api/tasks"),
  );
  await input.fill(title);
  await input.press("Control+Enter");
  expect((await created).postData() ?? "").toContain(title);
  await expect(page.locator(".ds__task-item", { hasText: title })).toHaveCount(1);
  await expect(input).toHaveValue("");

  await expect(add).toBeDisabled();
  const before = await page.locator(".ds__task-item").count();
  await input.press("Control+Enter");
  await expect(input).toHaveValue("");
  await expect(add).toBeDisabled();
  expect(await page.locator(".ds__task-item").count()).toBe(before);
});
