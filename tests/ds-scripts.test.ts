import { describe, expect, it } from "vite-plus/test";
import { DS_SCRIPT } from "../src/client/ds-scripts";
import { scriptDiagnostics } from "./helpers/client-script";

describe("DS browser script", () => {
  it("is valid JavaScript", () => {
    expect(scriptDiagnostics(DS_SCRIPT)).toEqual([]);
  });

  it("drives the browser transport methods", () => {
    for (const method of [
      "browser.start",
      "browser.navigate",
      "browser.history",
      "browser.input",
      "browser.resize",
      "browser.tab.new",
      "browser.tab.close",
      "browser.tab.select",
    ]) {
      expect(DS_SCRIPT).toContain(method);
    }
    expect(DS_SCRIPT).toContain("ds-browser-canvas");
  });


  it("collapses project groups and stores the state in localStorage", () => {
    expect(DS_SCRIPT).toContain("[data-ds-group-toggle]");
    expect(DS_SCRIPT).toContain("ds-group-collapsed:v1");
    expect(DS_SCRIPT).toContain("data-collapsed");
    expect(DS_SCRIPT).toContain("localStorage.setItem");
  });

  it("creates a task from the composer and inserts it into the matching project group (BDD-TM-027)", () => {
    for (const hook of [
      "ds-new-task",
      "ds-new-title",
      "ds-new-add",
      "ds-new-project",
      "ds-new-error",
      'fetch("/api/tasks"',
      "ds__task-item",
      "is-new",
      "scrollIntoView",
      'position: "first"',
      "list.insertBefore(row, list.firstElementChild)",
      "compositionstart",
      "Escape",
      "requestSubmit",
      "ctrlKey",
      "metaKey",
    ]) {
      expect(DS_SCRIPT).toContain(hook);
    }
    expect(DS_SCRIPT).toContain("ds__group-count");
    expect(DS_SCRIPT).toContain("保存に失敗しました。もう一度お試しください。");
  });

});

describe("DS task action menu", () => {
  it("opens the English task action menu with status, project, copy and working (BDD-TM-030)", () => {
    expect(DS_SCRIPT).toContain("contextmenu");
    expect(DS_SCRIPT).toContain("data-task-version");
    expect(DS_SCRIPT).toContain("data-task-project");
    expect(DS_SCRIPT).toContain("/api/tasks/");
    for (const label of ["status", "project", "copy title", "working", "delete", "未分類"]) {
      expect(DS_SCRIPT).toContain(label);
    }
    expect(DS_SCRIPT).toContain('["do", "done", "skip"]');
    expect(DS_SCRIPT).toContain("navigator.clipboard.writeText");
    expect(DS_SCRIPT).not.toContain("タスク詳細を開く");
    expect(DS_SCRIPT).not.toContain("リンクをコピー");
    expect(DS_SCRIPT).not.toContain("進行中");
  });

  it("positions the menu like the OS context menu (flip at the screen edges)", () => {
    for (const hook of [
      "placeMenuAtPointer",
      "placeSubmenu",
      "MENU_OFFSET",
      "MENU_PADDING",
      "window.innerWidth - rect.width - MENU_PADDING",
      "window.innerHeight - rect.height - MENU_PADDING",
      "box.style.maxHeight",
      'box.style.overflowY = "auto"',
    ]) {
      expect(DS_SCRIPT).toContain(hook);
    }
  });
});

describe("DS task pane shortcuts", () => {
  it("saves with Ctrl/Cmd + S from anywhere on the DS screen (BDD-TM-041)", () => {
    expect(DS_SCRIPT).toContain('var key = typeof event.key === "string" ? event.key.toLowerCase() : ""');
    expect(DS_SCRIPT).toContain('key !== "s" || !(event.ctrlKey || event.metaKey)');
    // The browser save dialog is blocked even when there is nothing to save.
    expect(DS_SCRIPT).toContain("event.preventDefault();");
    expect(DS_SCRIPT).toContain("if (!titleInput || !descriptionInput || !dirty()) return;");
  });

});

describe("DS task list DnD", () => {
  it("moves tasks between project groups and reorders projects by drag and drop (BDD-TM-025)", () => {
    for (const hook of [
      "dragstart",
      "dragover",
      "drop",
      "dragend",
      "dataTransfer",
      'setAttribute("draggable", "false")',
      "ds__group--drop",
      "preventDefault",
    ]) {
      expect(DS_SCRIPT).toContain(hook);
    }
    expect(DS_SCRIPT).toContain("/api/projects/reorder");
    expect(DS_SCRIPT).toContain("ds-groups-status");
    expect(DS_SCRIPT).toContain("タスクを移動できませんでした");
    expect(DS_SCRIPT).toContain("プロジェクトを並び替えできませんでした");
  });

  it("reorders tasks within a project group by drag and drop (BDD-TM-026)", () => {
    expect(DS_SCRIPT).toContain("/api/tasks/reorder");
    expect(DS_SCRIPT).toContain("ds__task-item--drop-before");
    expect(DS_SCRIPT).toContain("ds__task-item--drop-after");
    expect(DS_SCRIPT).toContain("タスクを並び替えできませんでした");
  });

  it("deletes through the centered confirm dialog instead of window.confirm (BDD-TM-033)", () => {
    expect(DS_SCRIPT).not.toContain("window.confirm(");
    expect(DS_SCRIPT).toContain("window.__siftqConfirm");
    expect(DS_SCRIPT).toContain("このタスクを削除しますか？");
  });

  it("saves the task pane title and description through the task API (BDD-TM-036)", () => {
    for (const hook of [
      'getElementById("ds-task-title")',
      'getElementById("ds-task-description")',
      'getElementById("ds-task-save")',
      'getElementById("ds-task-status")',
    ]) {
      expect(DS_SCRIPT).toContain(hook);
    }
    expect(DS_SCRIPT).toContain('fetch("/api/tasks/" + encodeURIComponent');
    expect(DS_SCRIPT).toContain('method: "PATCH"');
    expect(DS_SCRIPT).toContain("version: Number(pane.getAttribute(\"data-task-version\"))");
  });

  it("keeps unsaved edits, reports conflicts and updates the left card (BDD-TM-036)", () => {
    // The chat script reads this flag before applying agent updates.
    expect(DS_SCRIPT).toContain('pane.setAttribute("data-dirty", "true")');
    expect(DS_SCRIPT).toContain("他の更新と衝突しました");
    expect(DS_SCRIPT).toContain("未保存の変更");
    expect(DS_SCRIPT).toContain("保存しました");
    // Escape restores the baseline, Ctrl/Cmd + Enter saves.
    expect(DS_SCRIPT).toContain('event.key === "Escape"');
    expect(DS_SCRIPT).toContain('event.key === "Enter" && (event.ctrlKey || event.metaKey)');
    expect(DS_SCRIPT).toContain('row.querySelector(".ds__task-title")');
    expect(DS_SCRIPT).toContain('addEventListener("ds-task-description"');
  });

  it("rejects non-http URLs and ignores frames from inactive tabs", () => {
    expect(DS_SCRIPT).toContain("http(s) の URL のみ開けます");
    expect(DS_SCRIPT).toContain("tabId");
  });
});

describe("DS description preview tabs", () => {
  it("previews the description through the shared 編集 / プレビュー tabs (BDD-TM-006)", () => {
    for (const hook of [
      "[data-description-tabs]",
      "[data-description-tab]",
      "[data-description-panel]",
      "[data-description-preview]",
      'fetch("/api/markdown/preview"',
      'document.addEventListener("click", handleDescriptionTabClick)',
      'document.addEventListener("keydown", handleDescriptionTabKeydown)',
      'document.addEventListener("DOMContentLoaded", refreshDescriptionTabs)',
      'document.addEventListener("htmx:load", refreshDescriptionTabs)',
      "ArrowRight",
      "ArrowLeft",
      '"Home"',
      '"End"',
    ]) {
      expect(DS_SCRIPT).toContain(hook);
    }
    // The DS editor is a textarea, so the shared reader falls back to its value.
    expect(DS_SCRIPT).toContain('root.querySelector("textarea[data-description-value]")');
  });
});
