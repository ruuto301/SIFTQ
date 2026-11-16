import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const PIXEL_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function signIn(page: Page) {
  await page.goto("/ideas");
  await expect(page).toHaveURL(/\/ideas$/);
}

async function saveTask(page: Page): Promise<void> {
  const saved = page.waitForResponse(
    (response) => response.request().method() === "POST" && /^\/tasks\/[^/]+$/.test(new URL(response.url()).pathname),
  );
  await page.getByRole("button", { name: "Save" }).click();
  await saved;
}

async function createTask(page: Page, title: string): Promise<string> {
  return page.evaluate(async (taskTitle) => {
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: taskTitle, description: "" }),
    });
    if (!response.ok) throw new Error(`create task failed: ${response.status}`);
    const task = await response.json();
    return task.id;
  }, title);
}

async function deleteTask(page: Page, id: string): Promise<void> {
  await page.evaluate(async (taskId) => {
    await fetch(`/api/tasks/${taskId}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ version: 1 }),
    });
  }, id);
}

function dispatchPaste(element: Element, encoded: string): void {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const file = new File([bytes], "pixel.png", { type: "image/png" });
  const transfer = new DataTransfer();
  transfer.items.add(file);
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", { value: transfer });
  element.dispatchEvent(event);
}

async function pasteImage(page: Page, selector: string, base64: string): Promise<void> {
  await page.locator(selector).evaluate(dispatchPaste, base64);
}

function dispatchDrop(element: Element, payload: { encoded: string; name: string; type: string }): boolean {
  const binary = atob(payload.encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const file = new File([bytes], payload.name, { type: payload.type });
  const transfer = new DataTransfer();
  transfer.items.add(file);

  const dragover = new Event("dragover", { bubbles: true, cancelable: true });
  Object.defineProperty(dragover, "dataTransfer", { value: transfer });
  element.dispatchEvent(dragover);

  const drop = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(drop, "dataTransfer", { value: transfer });
  element.dispatchEvent(drop);

  return dragover.defaultPrevented;
}

async function dropImage(
  page: Page,
  selector: string,
  payload: { encoded: string; name: string; type: string },
): Promise<boolean> {
  return page.locator(selector).evaluate(dispatchDrop, payload);
}

test("pasting an image into the task description editor saves and renders it", async ({ page }) => {
  await signIn(page);
  const taskId = await createTask(page, `E2E image ${Date.now()}`);

  try {
    await page.goto(`/tasks/${taskId}?from=tasks`);
    const editor = page.locator("[data-description-editor]");
    await pasteImage(page, "[data-description-editor]", PIXEL_PNG);

    const image = editor.locator("img.description-image");
    await expect(image).toHaveCount(1);
    await expect(image).toHaveAttribute("src", /^\/api\/images\//);

    const token = await page.locator("textarea[data-description-value]").inputValue();
    expect(token).toMatch(/^\/api\/images\/[0-9A-Za-z_-]+$/);

    await saveTask(page);
    await page.goto(`/tasks/${taskId}?from=tasks`);

    await expect(page.locator("[data-description-editor] img.description-image")).toHaveCount(1);
    await page.reload();
    await expect(page.locator("[data-description-editor] img.description-image")).toHaveCount(1);
    await expect(page.locator("textarea[data-description-value]")).toHaveValue(token);
  } finally {
    await deleteTask(page, taskId);
  }
});

test("dropping a file with a hidden type into the task editor uploads and renders it", async ({ page }) => {
  await signIn(page);
  const taskId = await createTask(page, `E2E drop ${Date.now()}`);

  try {
    await page.goto(`/tasks/${taskId}?from=tasks`);
    const editor = page.locator("[data-description-editor]");
    const accepted = await dropImage(page, "[data-description-editor]", { encoded: PIXEL_PNG, name: "photo.png", type: "" });
    expect(accepted).toBe(true);

    const image = editor.locator("img.description-image");
    await expect(image).toHaveCount(1);
    await expect(image).toHaveAttribute("src", /^\/api\/images\//);

    await saveTask(page);
    await page.goto(`/tasks/${taskId}?from=tasks`);
    await expect(page.locator("[data-description-editor] img.description-image")).toHaveCount(1);
    await page.reload();
    await expect(page.locator("[data-description-editor] img.description-image")).toHaveCount(1);
  } finally {
    await deleteTask(page, taskId);
  }
});

test("pasting an image into the DS description saves and renders it (BDD-TM-049)", async ({ page }) => {
  await signIn(page);
  const taskId = await createTask(page, `E2E ds image ${Date.now()}`);

  try {
    await page.goto(`/ds?task=${taskId}`);
    const editor = page.locator("#ds-description-editor");
    await expect(editor).toBeVisible();

    await pasteImage(page, "#ds-description-editor", PIXEL_PNG);
    await expect(editor.locator("img.description-image")).toHaveCount(1);
    const token = await page.locator("#ds-task-description").inputValue();
    expect(token).toMatch(/^\/api\/images\/[0-9A-Za-z_-]+$/);

    await page.locator("#ds-task-save").click();
    await expect(page.locator("#ds-task-status")).toHaveText(/保存しました/);

    await page.reload();
    await expect(page.locator("#ds-description-editor img.description-image")).toHaveCount(1);
  } finally {
    await deleteTask(page, taskId);
  }
});

test("caps the description image and opens it in a lightbox (BDD-TM-051)", async ({ page }) => {
  await signIn(page);
  const taskId = await createTask(page, `E2E ds image size ${Date.now()}`);

  try {
    await page.goto(`/ds?task=${taskId}`);
    await pasteImage(page, "#ds-description-editor", PIXEL_PNG);

    const editorImage = page.locator("#ds-description-editor img.description-image");
    await expect(editorImage).toHaveCount(1);
    expect(await editorImage.evaluate((el) => getComputedStyle(el).maxHeight)).toBe("320px");

    expect(await editorImage.evaluate((el) => getComputedStyle(el).objectFit)).toBe("contain");

    await editorImage.click();
    await expect(page.locator("[data-description-lightbox]")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-description-lightbox]")).toBeHidden();
  } finally {
    await deleteTask(page, taskId);
  }
});
