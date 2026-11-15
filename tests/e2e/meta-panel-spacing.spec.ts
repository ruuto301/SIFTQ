import { expect, test } from "./fixtures";
import { createTask, openTaskFromList } from "./task-helpers";

type PanelGap = { heading: string; gap: number };

async function headingGaps(page: import("@playwright/test").Page, panelSelector: string): Promise<PanelGap[]> {
  return page.evaluate((selector) => {
    const panel = document.querySelector(selector);
    if (!panel) return [];
    const children = Array.from(panel.children);
    const gaps: PanelGap[] = [];
    children.forEach((element, index) => {
      if (!element.classList.contains("meta-row")) return;
      const next = children[index + 1];
      if (next === undefined || next.classList.contains("meta-row")) return;
      const heading = element.querySelector("h2")?.textContent ?? "";
      gaps.push({ heading, gap: Math.round(next.getBoundingClientRect().top - element.getBoundingClientRect().bottom) });
    });
    return gaps;
  }, panelSelector);
}

test("keeps the same gap between right panel headings and their controls", async ({ page }) => {
  await page.goto("/tasks/new");
  const newTaskGap = await page.evaluate(() => {
    const heading = document.querySelector("#new-task-meta .meta-row--spaced");
    const select = document.querySelector("#new-task-meta .project-select");
    if (!heading || !select) return -1;
    return Math.round(select.getBoundingClientRect().top - heading.getBoundingClientRect().bottom);
  });
  expect(newTaskGap).toBe(8);

  const title = `spacing ${Date.now()}`;
  await page.goto("/tasks");
  await createTask(page, title, "Yoriwake");
  await openTaskFromList(page, title, "do");

  const gaps = await headingGaps(page, "#task-meta");
  expect(gaps.map((entry) => entry.heading)).toEqual(["Status", "Project", "Working"]);
  expect(gaps.every((entry) => entry.gap === 8)).toBe(true);
});
