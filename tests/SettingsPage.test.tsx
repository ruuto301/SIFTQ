import { renderToString } from "hono/jsx/dom/server";
import { describe, expect, it } from "vite-plus/test";
import { SettingsPage } from "../src/views/SettingsPage";
import type { ProjectRow } from "../src/views/SettingsPage";

const ROWS: readonly ProjectRow[] = [
  { project: { id: "Yoriwake", name: "Yoriwake", sort_order: 1 }, count: 39 },
  { project: { id: "life", name: "生活", sort_order: 2 }, count: 0 },
];

function renderPage(rows: readonly ProjectRow[] = ROWS, unassigned = 131): string {
  return renderToString(<SettingsPage rows={rows} unassigned={unassigned} />);
}

describe("SettingsPage", () => {
  it("renders each project with its name, id and task count (BDD-TM-035)", () => {
    const html = renderPage();

    expect(html).toContain('data-project-id="Yoriwake"');
    expect(html).toContain('data-project-name="生活"');
    expect(html).toContain('data-count="39"');
    expect(html).toContain("39 件");
    expect(html).toContain("0 件");
  });

  it("offers rename, delete and reorder controls per row", () => {
    const html = renderPage();

    expect(html).toContain("data-project-rename");
    expect(html).toContain("data-project-delete");
    expect(html).toContain("data-project-up");
    expect(html).toContain("data-project-down");
    expect(html).toContain("data-settings-row");
  });

  it("shows the fixed 未分類 row with its count and an add form", () => {
    const html = renderPage();

    expect(html).toContain("未分類: 131 件");
    expect(html).toContain("固定・削除できません");
    expect(html).toContain("data-settings-add");
    expect(html).toContain('maxlength="32"');
  });

  it("renders an empty list without failing", () => {
    const html = renderPage([], 0);

    expect(html).toContain("未分類: 0 件");
    expect(html).toContain("data-settings-list");
  });
});
