import { renderToString } from "hono/jsx/dom/server";
import { describe, expect, it } from "vite-plus/test";
import { TaskMeta } from "../src/components/TaskMeta";
import type { Project } from "../src/project";
import { taskFixture } from "./helpers/task-fixture";

const PROJECTS: readonly Project[] = [
  { id: "Yoriwake", name: "Yoriwake", path: null, sort_order: 1, archived: false },
  { id: "dsh", name: "dsh", path: null, sort_order: 2, archived: false },
];

describe("TaskMeta", () => {
  it("renders status and a project select", () => {
    const html = renderToString(
      <TaskMeta task={taskFixture({ status: "do", project: "dsh" })} projects={PROJECTS} />,
    );

    expect(html).toContain("do");
    expect(html).toContain(">Project<");
    expect(html).toContain('aria-label="Project"');
    expect(html).toContain("未分類");
    expect(html).toContain('<option value="dsh" selected');
    expect(html).not.toContain("area-badge");
  });

  it("marks the unassigned option when the task has no project", () => {
    const html = renderToString(<TaskMeta task={taskFixture({ project: null })} projects={PROJECTS} />);

    expect(html).toContain('<option value="" selected');
    expect(html).toContain("project-select project-select--none");
  });

  it("posts the project change to the task project route", () => {
    const html = renderToString(<TaskMeta task={taskFixture({ id: "task-1" })} projects={PROJECTS} />);

    expect(html).toContain('hx-post="/tasks/task-1/project?from=tasks&amp;status=do"');
    expect(html).toContain('hx-trigger="change"');
  });
});
