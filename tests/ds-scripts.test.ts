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

  it("rejects non-http URLs and ignores frames from inactive tabs", () => {
    expect(DS_SCRIPT).toContain("http(s) の URL のみ開けます");
    expect(DS_SCRIPT).toContain("tabId");
  });
});
