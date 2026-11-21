import { expect, installHtmxRoute, test } from "./fixtures";
import { createTask } from "./task-helpers";

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/ideas");
  await expect(page).toHaveURL(/\/ideas$/);
}

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test("keeps the task list and task forms usable at the responsive widths", async ({ page }) => {
  await installHtmxRoute(page);
  await signIn(page);

  for (const width of [320, 360, 390, 412]) {
    await page.setViewportSize({ width, height: 960 });
    await page.goto("/tasks");
    await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("/tasks/new");
    await expect(page.getByRole("heading", { name: "New task" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    expect(await page.locator(".detail-grid").evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length,
    )).toBe(1);
    await page.locator('details[data-popover-close="status"] > summary').click();
    const popover = page.locator('[aria-label="Apply status to this task"]');
    await expect(popover).toBeVisible();
    const box = await popover.boundingBox();
    if (box === null) throw new Error("Status popover bounds are missing");
    expect(box.x + box.width).toBeLessThanOrEqual(width);
  }

  for (const width of [640, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 960 });
    await page.goto("/tasks/new");
    await expect(page.getByRole("heading", { name: "New task" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    const columns = await page.locator(".detail-grid").evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length,
    );
    expect(columns).toBe(width >= 768 ? 2 : 1);
  }
});

test("keeps every screen free of horizontal scrolling across the breakpoints (Issue #804)", async ({ page, context }) => {
  await signIn(page);

  // A task detail needs a real id; create one so `/tasks/<id>` is covered too.
  await page.goto("/tasks");
  const title = `responsive detail ${Date.now()}`;
  await createTask(page, title, "Yoriwake");
  const detailPath = await page
    .locator("[data-task-row]", { hasText: title })
    .locator(".task-row-link")
    .getAttribute("href");
  if (detailPath === null) throw new Error("The task detail path is missing");

  const paths = ["/ideas", "/tasks", "/tasks/new", detailPath, "/ds", "/settings", "/connections"];
  for (const width of [320, 360, 390, 412, 768, 960, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    for (const path of paths) {
      await page.goto(path);
      await expectNoHorizontalOverflow(page);
    }
  }

  // `/login` renders outside the session, so check it in a signed-out context.
  await context.clearCookies();
  for (const width of [320, 360, 390, 412, 768, 960, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/login");
    await expect(page.getByRole("link", { name: "Sign in with GitHub" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});

test("keeps the DS detail and the back control working on a narrow screen (Issue #804)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tasks");
  const title = `ds narrow detail ${Date.now()}`;
  await createTask(page, title, "Yoriwake");

  await page.goto("/ds");
  // The deferred DS script attaches the back control, so wait for the full load.
  await page.waitForLoadState("load");
  await page.locator(".ds__task-item", { hasText: title }).locator(".ds__task").click();
  await page.waitForLoadState("load");
  await expect(page.locator(".ds__pane--detail")).toBeVisible();
  await expect(page.locator(".ds__pane--tasks")).toBeHidden();
  await expect(page.locator("#ds-task-title")).toHaveValue(title);
  await expectNoHorizontalOverflow(page);

  const back = page.getByRole("button", { name: "一覧へ戻る" });
  await expect(back).toBeVisible();
  await back.click();
  await expect(page.locator(".ds__pane--tasks")).toBeVisible();
  await expect(page.locator(".ds__pane--detail")).toBeHidden();
});

test("keeps the DS status pills at their normal height and the list inside the viewport (Issue #804)", async ({ page }) => {
  for (const width of [320, 360, 390, 412]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/ds");

    // The shared toolbar rule used to stretch the pills to the pane height.
    const heights = await page.locator(".ds__status-tabs .button.small").evaluateAll((tabs) =>
      tabs.map((tab) => tab.getBoundingClientRect().height),
    );
    expect(heights).toHaveLength(3);
    for (const height of heights) {
      expect(height).toBeGreaterThanOrEqual(28);
      expect(height).toBeLessThanOrEqual(44);
    }
    expect(await page.locator(".ds__status-tabs").evaluate((tabs) => tabs.getBoundingClientRect().height))
      .toBeLessThanOrEqual(48);

    // The one-column shell stays viewport-sized and scrolls the task list inside the pane.
    const viewport = page.viewportSize();
    if (viewport === null) throw new Error("The viewport is missing");
    expect(await page.locator(".ds").evaluate((element) => element.getBoundingClientRect().height))
      .toBeLessThanOrEqual(viewport.height);
    expect(await page.locator(".ds__groups").evaluate((element) => getComputedStyle(element).overflowY))
      .toBe("auto");
  }

  // 390px (Issue AC): the page itself stays about one viewport tall.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ds");
  expect(await page.evaluate(() => document.documentElement.scrollHeight))
    .toBeLessThanOrEqual(844 + 24);
  await expectNoHorizontalOverflow(page);
});

test("wraps the settings project rows without overlap or overflow (Issue #804)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const row = page.locator("[data-settings-row]", { hasText: "Yoriwake" });
  await expect(row).toHaveCount(1);
  const name = await row.locator("[data-project-name-label]").boundingBox();
  const count = await row.locator(".settings-row__count").boundingBox();
  const remove = await row.getByRole("button", { name: "削除" }).boundingBox();
  if (name === null || count === null || remove === null) {
    throw new Error("The settings row bounds are missing");
  }
  // The name owns a full row, so it never sits on top of the count or the actions.
  expect(name.x + name.width).toBeLessThanOrEqual(390);
  expect(count.y).toBeGreaterThanOrEqual(name.y + name.height);
  expect(remove.x + remove.width).toBeLessThanOrEqual(390);
  expect(await row.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
});
