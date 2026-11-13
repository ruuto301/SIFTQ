import { renderToString } from "hono/jsx/dom/server";
import { describe, expect, it } from "vite-plus/test";
import { OptionMenu } from "../src/components/OptionMenu";
import type { Project } from "../src/project";
import { taskFixture } from "./helpers/task-fixture";

const PROJECTS: readonly Project[] = [
  { id: "Yoriwake", name: "Yoriwake", path: null, sort_order: 1, archived: false },
  { id: "dsh", name: "dsh", path: null, sort_order: 2, archived: false },
];

describe("OptionMenu", () => {
  it("renders all status choices in a popover", () => {
    const html = renderToString(
      <OptionMenu task={taskFixture({ id: "task-1" })} projects={PROJECTS} />,
    );
    expect(html).toContain("Apply status to this task");
    expect(html).toContain("do");
    expect(html).toContain("done");
    expect(html).toContain("skip");
  });

  it("keeps the project select out of the popover but in the side panel", () => {
    const html = renderToString(
      <OptionMenu task={taskFixture({ id: "task-1", project: "dsh" })} projects={PROJECTS} />,
    );
    expect(html).toContain('aria-label="Project"');
    expect(html).toContain("Selected status");
    expect(html).not.toContain("Apply area to this task");
  });
});
