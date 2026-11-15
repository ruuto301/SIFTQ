import { renderToString } from "hono/jsx/dom/server";
import { describe, expect, it } from "vite-plus/test";
import { TaskRow } from "../src/components/TaskRow";
import { taskFixture } from "./helpers/task-fixture";

describe("TaskRow", () => {
  it("renders title, project and status without an issue number", () => {
    const html = renderToString(<TaskRow task={taskFixture({ id: "task-1", project: "Yoriwake" })} />);
    expect(html).not.toContain("issue-number");
    expect(html).not.toContain("area-badge");
    expect(html).toContain("seed task");
    expect(html).toContain("#Yoriwake");
    expect(html).toContain("label label--project");
    expect(html).toContain("do");
    expect(html).toContain('data-task-id="task-1"');
    expect(html).toContain('data-version="1"');
  });

  it("prefers the project display name over the id (BDD-TM-034)", () => {
    const html = renderToString(
      <TaskRow task={taskFixture({ project: "life" })} projectName="生活" />,
    );

    expect(html).toContain("#生活");
    expect(html).not.toContain("#life");
  });

  it("shows 未分類 for an unassigned task", () => {
    const html = renderToString(<TaskRow task={taskFixture({ project: null })} />);

    expect(html).toContain("label label--project label--project-none");
    expect(html).toContain("未分類");
  });

  it("marks working tasks with a badge and working class", () => {
    const html = renderToString(<TaskRow task={taskFixture({ working: true, project: "dsh" })} />);
    expect(html).toContain('class="task-row task-row--working"');
    expect(html).toContain('class="working-badge">working</span>');
  });
});
