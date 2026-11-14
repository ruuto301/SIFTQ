import { expect, test } from "./fixtures";

type Computed = {
  background: string;
  color: string;
  borderColor: string;
  borderWidth: string;
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
      radius: style.borderTopLeftRadius,
    };
  }, selector);
}

test("renders the unified black and white palette", async ({ page }) => {
  await page.goto("/tasks");
  const topbar = await computed(page, ".topbar");
  expect(topbar?.background).toBe("rgb(255, 255, 255)");
  expect(topbar?.borderColor).toBe("rgb(27, 31, 36)");

  const activeNav = await computed(page, ".nav .active");
  expect(activeNav?.background).toBe("rgb(27, 31, 36)");
  expect(activeNav?.color).toBe("rgb(255, 255, 255)");

  const inactiveNav = await computed(page, ".nav a:not(.active)");
  expect(inactiveNav?.background).toBe("rgb(255, 255, 255)");
  expect(inactiveNav?.radius).toBe("999px");

  const list = await computed(page, ".list");
  expect(list?.background).toBe("rgb(255, 255, 255)");

  await page.goto("/ds");
  const ds = await computed(page, ".ds");
  expect(ds?.background).toBe("rgb(255, 255, 255)");
  const activeTab = await computed(page, ".ds__tab.active");
  expect(activeTab?.background).toBe("rgb(27, 31, 36)");
  expect(activeTab?.color).toBe("rgb(255, 255, 255)");
});

test("keeps done and skip as outlined muted accents", async ({ page }) => {
  const title = `palette done ${Date.now()}`;
  await page.goto("/tasks/new?status=done");
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
  await page.goto("/tasks?status=done");

  const done = await computed(page, ".task-row .status--done");
  expect(done?.background).toBe("rgba(0, 0, 0, 0)");
  expect(done?.borderColor).toBe("rgb(63, 107, 79)");

  const activeFilter = await computed(page, ".task-status-filter .button.is-active");
  expect(activeFilter?.background).toBe("rgb(27, 31, 36)");
});

test("keeps the login page on a white surface", async ({ page, context }) => {
  await context.clearCookies();
  await page.goto("/login");
  const login = await computed(page, ".login");
  expect(login?.background).toBe("rgb(255, 255, 255)");
  const card = await computed(page, ".login-card");
  expect(card?.background).toBe("rgb(255, 255, 255)");
});
