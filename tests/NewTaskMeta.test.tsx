import { renderToString } from "hono/jsx/dom/server";
import { describe, expect, it } from "vite-plus/test";
import { NewTaskMeta } from "../src/components/NewTaskMeta";
import type { Project } from "../src/project";

const PROJECTS: readonly Project[] = [
  { id: "Yoriwake", name: "Yoriwake", sort_order: 1 },
  { id: "dsh", name: "dsh", sort_order: 2 },
];

describe("NewTaskMeta", () => {
  it("renders status radio choices with the selected status", () => {
    const html = renderToString(<NewTaskMeta state={{ status: "done", project: "dsh" }} projects={PROJECTS} />);

    expect(html).toContain('<details data-popover-close="status">');
    expect(html).toContain("Apply status to this task");
    expect(html).toContain('name="status" value="done" checked');
    expect(html).toContain('<button type="button" class="status-choice" data-popover-cancel="true" data-cancel="true">');
  });

  it("renders the project select with the selected project", () => {
    const html = renderToString(<NewTaskMeta state={{ status: "do", project: "dsh" }} projects={PROJECTS} />);

    expect(html).toContain('name="project"');
    expect(html).toContain('<option value="dsh" selected');
    expect(html).toContain("未分類");
    expect(html).not.toContain('name="area"');
    expect(html).not.toContain("Apply area to this task");
  });

  it("selects the unassigned option when no project is set", () => {
    const html = renderToString(<NewTaskMeta state={{ status: "do", project: null }} projects={PROJECTS} />);

    expect(html).toContain('<option value="" selected');
    expect(html).toContain("project-select project-select--none");
  });
});
