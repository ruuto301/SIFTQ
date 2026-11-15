import { expect, test } from "./fixtures";
import { signIn } from "./task-helpers";

test("keeps the search filters when switching status tabs", async ({ page }) => {
  await signIn(page);
  await page.goto(`/tasks?q=${encodeURIComponent("is:do working:on")}`);
  const search = page.getByLabel("Search tasks");
  await expect(search).toHaveValue("is:do working:on");

  await page.getByRole("link", { name: "done", exact: true }).click();

  await expect(search).toHaveValue("is:done working:on");
  await expect(page.getByRole("link", { name: "done", exact: true })).toHaveAttribute("aria-current", "true");
});
