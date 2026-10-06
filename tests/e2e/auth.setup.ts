import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { authStatePath, expect, test as setup } from "./fixtures";

setup("authenticate", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Sign in with GitHub" }).click();
  await expect(page).toHaveURL(/\/ideas$/);

  mkdirSync(dirname(authStatePath), { recursive: true });
  await page.context().storageState({ path: authStatePath });
});
