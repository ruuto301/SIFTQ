import { expect, test } from "./fixtures";
import { signIn } from "./task-helpers";

test("keeps the working search token through the search round trip", async ({ page }) => {
  await signIn(page);
  await page.goto("/tasks");
  const search = page.getByLabel("Search tasks");
  await expect(search).toHaveValue("is:do");

  await search.fill("is:do working:on");
  await page.getByRole("button", { name: "Submit search" }).click();

  await expect(search).toHaveValue("is:do working:on");
  await expect(page).toHaveURL(/q=is%3Ado(\+|%20)working%3Aon/);
  await expect(page.locator(".task-label-menu a.is-selected", { hasText: "working:on" })).toHaveText("working:on");
});
