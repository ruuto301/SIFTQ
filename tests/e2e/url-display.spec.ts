import { expect, test } from "./fixtures";
import { signIn } from "./task-helpers";

const ENCODED = "https://example.com/%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B?q=%E6%97%A5%E6%9C%AC%E8%AA%9E";
const DECODED_TEXT = "問い合わせ";

async function createTask(page: Parameters<typeof signIn>[0], title: string, description: string): Promise<string> {
  return page.evaluate(async ({ title: taskTitle, description: body }) => {
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: taskTitle, description: body }),
    });
    if (!response.ok) throw new Error(`create task failed: ${response.status}`);
    const task: unknown = await response.json();
    if (typeof task !== "object" || task === null || !("id" in task) || typeof task.id !== "string") {
      throw new Error("task id is missing");
    }
    return task.id;
  }, { title, description });
}

async function createIdea(page: Parameters<typeof signIn>[0], title: string, body: string): Promise<void> {
  await page.evaluate(async ({ title: ideaTitle, body: ideaBody }) => {
    const response = await fetch("/api/ideas/notes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: ideaTitle, body: ideaBody }),
    });
    if (!response.ok) throw new Error(`create idea failed: ${response.status}`);
  }, { title, body });
}

test("shows Japanese for a percent-encoded link in the task description (BDD-TM-055)", async ({ page }) => {
  await signIn(page);
  const taskId = await createTask(page, `url task ${Date.now()}`, `参考: ${ENCODED}`);

  await page.goto(`/tasks/${taskId}`);
  const link = page.locator(".description-preview a").first();
  await expect(link).toContainText(DECODED_TEXT);
  await expect(link).toHaveAttribute("href", ENCODED);
});

test("shows Japanese for a percent-encoded link on the Ideas card (BDD-TM-055)", async ({ page }) => {
  await signIn(page);
  const title = `url idea ${Date.now()}`;
  await createIdea(page, title, `参考: ${ENCODED}`);

  await page.goto("/ideas");
  const card = page.locator(".idea-card").filter({ hasText: title });
  const link = card.locator(".idea-card__plain-link a");
  await expect(link).toContainText(DECODED_TEXT);
  await expect(link).toHaveAttribute("href", ENCODED);
});
