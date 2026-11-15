import { expect, test } from "./fixtures";

type Computed = {
  background: string;
  color: string;
  borderColor: string;
  borderWidth: string;
  fontFamily: string;
  radius: string;
};

async function computed(page: import("@playwright/test").Page, selector: string): Promise<Computed | null> {
  return page.evaluate((target) => {
    const element = document.querySelector(target);
    if (!element) return null;
    const style = getComputedStyle(element);
    return {
      background: style.backgroundColor,
      color: style.color,
      borderColor: style.borderTopColor,
      borderWidth: style.borderTopWidth,
      fontFamily: style.fontFamily,
      radius: style.borderTopLeftRadius,
    };
  }, selector);
}

async function createRows(page: import("@playwright/test").Page, count: number) {
  for (let index = 0; index < count; index += 1) {
    await page.goto("/tasks/new");
    await page.getByLabel("Title").fill(`palette row ${Date.now()}-${index}`);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
  }
}

test("renders the monochrome page tone and the reading fonts (BDD-TM-038)", async ({ page }) => {
  await page.goto("/tasks");
  const root = await computed(page, "html");
  expect(root?.background).toBe("rgb(204, 204, 204)");

  const body = await computed(page, "body");
  expect(body?.color).toBe("rgb(48, 48, 48)");
  expect(body?.fontFamily).toContain("Atkinson Hyperlegible");
  expect(body?.fontFamily).toContain("Noto Sans JP");
});

test("outlines the header and the controls (BDD-TM-038)", async ({ page }) => {
  await page.goto("/tasks");
  const topbar = await computed(page, ".topbar");
  expect(topbar?.background).toBe("rgb(204, 204, 204)");
  expect(topbar?.borderColor).toBe("rgb(189, 189, 189)");

  const activeNav = await computed(page, ".nav .active");
  expect(activeNav?.background).toBe("rgb(38, 38, 38)");
  expect(activeNav?.color).toBe("rgb(220, 220, 220)");
  expect(activeNav?.borderColor).toBe("rgb(220, 220, 220)");

  const inactiveNav = await computed(page, ".nav a:not(.active)");
  expect(inactiveNav?.background).toBe("rgb(228, 228, 228)");
  expect(inactiveNav?.borderWidth).toBe("2px");
  expect(inactiveNav?.radius).toBe("999px");

  const button = await computed(page, ".button");
  expect(button?.background).toBe("rgb(228, 228, 228)");
  expect(button?.borderColor).toBe("rgb(31, 31, 31)");
});

test("frames the task list with one outer border and hairline rows (BDD-TM-038)", async ({ page }) => {
  await page.goto("/tasks");
  await createRows(page, 2);
  await page.goto("/tasks");

  const list = await computed(page, ".list");
  expect(list?.background).toBe("rgb(216, 216, 216)");
  expect(list?.borderColor).toBe("rgb(31, 31, 31)");
  expect(list?.borderWidth).toBe("2px");

  const rows = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll(".task-row"));
    const firstRow = items[0];
    const secondRow = items[1];
    if (firstRow === undefined || secondRow === undefined) return null;
    const first = getComputedStyle(firstRow);
    const second = getComputedStyle(secondRow);
    return { first: first.borderTopWidth, second: `${second.borderTopWidth} ${second.borderTopColor}` };
  });
  expect(rows).toEqual({ first: "0px", second: "1px rgb(189, 189, 189)" });
});

test("outlines the dropdown menu and each item (BDD-TM-038)", async ({ page }) => {
  await page.goto("/tasks");
  await page.locator("summary", { hasText: "Mark as" }).click();

  const menu = await computed(page, ".task-bulk-menu-items");
  expect(menu?.borderWidth).toBe("2px");
  expect(menu?.borderColor).toBe("rgb(31, 31, 31)");

  const menuItem = await computed(page, ".task-bulk-menu-items button");
  expect(menuItem?.borderWidth).toBe("1px");
  expect(menuItem?.borderColor).toBe("rgb(31, 31, 31)");
});

test("renders the same palette on the DS screen (BDD-TM-038)", async ({ page }) => {
  await page.goto("/ds");
  const ds = await computed(page, ".ds");
  expect(ds?.background).toBe("rgb(204, 204, 204)");

  const pane = await computed(page, ".ds__pane--tasks");
  expect(pane?.background).toBe("rgb(216, 216, 216)");
  expect(pane?.borderWidth).toBe("2px");

  const activeTab = await computed(page, ".ds__tab.active");
  expect(activeTab?.background).toBe("rgb(38, 38, 38)");
  expect(activeTab?.color).toBe("rgb(220, 220, 220)");
});

test("keeps done as an inverted monochrome accent (BDD-TM-038)", async ({ page }) => {
  const title = `palette done ${Date.now()}`;
  await page.goto("/tasks/new?status=done");
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
  await page.goto("/tasks?status=done");

  const done = await computed(page, ".task-row .status--done");
  expect(done?.background).toBe("rgb(38, 38, 38)");
  expect(done?.borderColor).toBe("rgb(220, 220, 220)");
  expect(done?.color).toBe("rgb(220, 220, 220)");

  const activeFilter = await computed(page, ".task-status-filter .button.is-active");
  expect(activeFilter?.background).toBe("rgb(38, 38, 38)");
});

test("keeps the login page on the page tone (BDD-TM-038)", async ({ page, context }) => {
  await context.clearCookies();
  await page.goto("/login");
  const login = await computed(page, ".login");
  expect(login?.background).toBe("rgb(204, 204, 204)");

  const card = await computed(page, ".login-card");
  expect(card?.background).toBe("rgb(216, 216, 216)");
  expect(card?.borderWidth).toBe("2px");
});
