import { describe, expect, it } from "vite-plus/test";
import { DS_SCRIPT } from "../src/client/ds-scripts";
import { scriptDiagnostics } from "./helpers/client-script";

describe("DS script", () => {
  it("is valid JavaScript", () => {
    expect(scriptDiagnostics(DS_SCRIPT)).toEqual([]);
  });

  it("resizes the left pane and stores the width in localStorage", () => {
    for (const hook of [
      ".ds__resizer",
      "ds-layout:v1",
      'style.setProperty("--ds-left"',
      "setPointerCapture",
      "dragging",
    ]) {
      expect(DS_SCRIPT).toContain(hook);
    }
  });

  it("does not drive the removed browser, chat or settings panes", () => {
    for (const removed of ["browser.start", "browser.navigate", "ds-browser", "dsh-chat", "ds-settings", "__dsBridge"]) {
      expect(DS_SCRIPT).not.toContain(removed);
    }
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

describe("DS pane resizer", () => {
  it("computes the free range from the container and persists px plus ratio", () => {
    for (const hook of [
      "dsLayoutLimits",
      "clampDsLayoutLeft",
      "dsLayoutWidthForContainer",
      "parseDsLayout",
      "serializeDsLayout",
      "data-ds-width-tag",
      "aria-valuenow",
      '"resize"',
      "matchMedia",
      "data-ds-back",
    ]) {
      expect(DS_SCRIPT).toContain(hook);
    }
    // The old fixed 180-520px clamp is gone.
    expect(DS_SCRIPT).not.toContain("Math.min(520");
  });

  it("supports double-click reset and keyboard width adjustment", () => {
    for (const hook of [
      "dblclick",
      "ArrowLeft",
      "ArrowRight",
      "event.shiftKey ? 24 : 8",
      'event.key === "Home"',
      'event.key === "End"',
      "event.preventDefault()",
    ]) {
      expect(DS_SCRIPT).toContain(hook);
    }
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

  it("copies the selected task id with a textarea fallback (BDD-TM-030)", () => {
    expect(DS_SCRIPT).toContain('addItem(box, "copy id", "copy-id", false)');
    expect(DS_SCRIPT).toContain('action === "copy-id"');
    expect(DS_SCRIPT).toContain('row.getAttribute("data-task-id")');
    // The async clipboard API falls back to a hidden textarea + execCommand("copy").
    expect(DS_SCRIPT).toContain("document.execCommand(\"copy\")");
    expect(DS_SCRIPT).toContain("document.createElement(\"textarea\")");
    expect(DS_SCRIPT).toContain("ds-groups-status");
    // Same English notification style as `copy title`.
    expect(DS_SCRIPT).toContain('{ ok: "copied id", ng: "copy failed" }');
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
  it("saves immediately with Ctrl/Cmd + S and blocks the browser default (BDD-TM-041)", () => {
    expect(DS_SCRIPT).toContain('key !== "s"');
    expect(DS_SCRIPT).toContain('event.key.toLowerCase()');
    expect(DS_SCRIPT).toContain('getElementById("ds-task-save")');
    expect(DS_SCRIPT).toContain('if (saveButton) saveButton.addEventListener("click", saveNow);');
    expect(DS_SCRIPT).toContain("if (key !== \"s\" || !(event.ctrlKey || event.metaKey)) return;");
    expect(DS_SCRIPT).toContain("event.preventDefault();\n      if (!titleInput || !descriptionInput) return;\n      saveNow();");
  });

  it("saves the title with Ctrl/Cmd + Enter and reverts with Escape (BDD-TM-036)", () => {
    expect(DS_SCRIPT).toContain('event.key === "Enter" && (event.ctrlKey || event.metaKey)');
    expect(DS_SCRIPT).toContain('event.key === "Escape"');
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

  it("saves the task detail title and description through the task API (BDD-TM-036)", () => {
    for (const hook of [
      'getElementById("ds-task-title")',
      'getElementById("ds-task-description")',
      'getElementById("ds-task-status")',
    ]) {
      expect(DS_SCRIPT).toContain(hook);
    }
    expect(DS_SCRIPT).toContain('fetch("/api/tasks/" + encodeURIComponent');
    expect(DS_SCRIPT).toContain('method: "PATCH"');
    expect(DS_SCRIPT).toContain("version: Number(pane.getAttribute(\"data-task-version\"))");
  });

  it("autosaves title and description 600ms after input stops (BDD-TM-036)", () => {
    expect(DS_SCRIPT).toContain("setTimeout(function () {");
    expect(DS_SCRIPT).toContain("}, 600);");
    expect(DS_SCRIPT).toContain("saveDirty(false);");
    expect(DS_SCRIPT).toContain('addEventListener("input", function (event)');
    expect(DS_SCRIPT).toContain('setStatus("保存中…", "saving")');
    expect(DS_SCRIPT).toContain('setStatus("保存できませんでした", "error")');
  });

  it("keeps unsaved edits, reports conflicts and updates the left card (BDD-TM-036)", () => {
    expect(DS_SCRIPT).toContain("他の更新と衝突しました");
    expect(DS_SCRIPT).toContain("未保存の変更");
    expect(DS_SCRIPT).toContain("保存しました");
    expect(DS_SCRIPT).toContain('row.querySelector(".ds__task-title")');
    // The removed chat pane no longer forwards description updates.
    expect(DS_SCRIPT).not.toContain('addEventListener("ds-task-description"');
  });
});

describe("DS task autosave", () => {
  it("does not multiplex saves and keeps the latest title and description (BDD-TM-036)", () => {
    expect(DS_SCRIPT).toContain("if (titleChanged) queuedTitle = true;");
    expect(DS_SCRIPT).toContain("if (descriptionChanged) queuedDescription = true;");
    // A queued title save survives a queued description save.
    expect(DS_SCRIPT).toContain("var nextTitle = queuedTitle;");
    expect(DS_SCRIPT).toContain("var nextDescription = queuedDescription;");
    // The pending text survives the response; the next request sends it.
    expect(DS_SCRIPT).toContain("if (descriptionInput.value === sentDescription) descriptionInput.value = task.description;");
    expect(DS_SCRIPT).toContain("if (titleInput.value.trim() === sentTitle) titleInput.value = task.title;");
  });

  it("patches only the changed fields (BDD-TM-036)", () => {
    expect(DS_SCRIPT).toContain("function save(sendsTitle, sendsDescription) {");
    expect(DS_SCRIPT).toContain("if (sendsTitle) patch.title = title;");
    expect(DS_SCRIPT).toContain("if (sendsDescription) patch.description = descriptionInput.value;");
  });

  it("ignores a late response after Escape reverts the pane (BDD-TM-036)", () => {
    expect(DS_SCRIPT).toContain("saveGeneration += 1;");
    expect(DS_SCRIPT).toContain("if (generation !== saveGeneration) return;");
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
