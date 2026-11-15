import { expect, test } from "./fixtures";
import { signIn } from "./task-helpers";

test("keeps the label filter in the search row, left of the submit button (BDD-TM-040)", async ({ page }) => {
  await signIn(page);
  await page.goto("/tasks");

  const search = page.locator(".task-search");
  const filter = search.locator(".task-label-filter");
  await expect(filter).toHaveCount(1);
  await expect(filter.locator("summary")).toHaveText("Filter");
  await expect(page.locator(".task-list-toolbar .task-label-filter")).toHaveCount(0);

  const positions = await page.evaluate(() => {
    const form = document.querySelector(".task-search");
    const x = (element: Element | null | undefined) =>
      element ? Math.round(element.getBoundingClientRect().x) : null;
    return {
      input: x(form?.querySelector('input[type="search"]')),
      filter: x(form?.querySelector(".task-label-filter summary")),
      submit: x(form?.querySelector(".task-search-button")),
    };
  });
  expect(positions.input).not.toBeNull();
  expect(positions.filter).toBeGreaterThan(positions.input ?? 0);
  expect(positions.submit).toBeGreaterThan(positions.filter ?? 0);
});

test("inverts the filter while a label filter is active (BDD-TM-040)", async ({ page }) => {
  await signIn(page);
  await page.goto("/tasks?q=is:do%20working:on");

  const summary = page.locator(".task-search .task-label-filter summary");
  await expect(summary).toHaveText("Filter");
  const style = await summary.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { background: computed.backgroundColor, border: computed.borderTopColor };
  });
  expect(style.background).toBe("rgb(38, 38, 38)");
  expect(style.border).toBe("rgb(220, 220, 220)");
});
