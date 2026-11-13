import { renderToString } from "hono/jsx/dom/server";
import { describe, expect, it } from "vite-plus/test";
import { ProjectOptions } from "../src/components/ProjectOptions";
import type { Project } from "../src/project";

const PROJECTS: readonly Project[] = [
  { id: "Yoriwake", name: "Yoriwake", path: null, sort_order: 1, archived: false },
  { id: "dsh", name: "dsh", path: null, sort_order: 2, archived: false },
];

describe("ProjectOptions", () => {
  it("renders 未分類 first and selects it when there is no project", () => {
    const html = renderToString(<ProjectOptions projects={PROJECTS} selected={null} />);

    expect(html).toContain('<option value="" selected');
    expect(html).toContain("未分類");
    expect(html.indexOf("未分類")).toBeLessThan(html.indexOf("Yoriwake"));
  });

  it("marks the selected project", () => {
    const html = renderToString(<ProjectOptions projects={PROJECTS} selected="dsh" />);

    expect(html).toContain('<option value="dsh" selected');
    expect(html).not.toContain('<option value="" selected');
  });
});
