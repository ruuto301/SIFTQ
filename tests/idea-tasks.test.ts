import { describe, expect, it } from "vite-plus/test";
import type { Idea } from "../src/idea";
import { createIdea, moveIdeaToTask } from "../src/idea-tasks";
import { taskFixture } from "./helpers/task-fixture";

function ideaFixture(overrides: Partial<Idea> = {}): Idea {
  return {
    id: "idea-1",
    owner_id: "local",
    title: "idea",
    description: "",
    order: 1,
    pinned: false,
    ...overrides,
  };
}

describe("createIdea", () => {
  it("orders the new idea within its pinned group", () => {
    const existing = [ideaFixture({ id: "pinned", pinned: true, order: 4 }), ideaFixture({ id: "plain", order: 2 })];

    expect(createIdea(existing, { title: "memo", description: "body", pinned: true })).toMatchObject({
      owner_id: "local",
      title: "memo",
      description: "body",
      order: 5,
      pinned: true,
    });
  });
});

describe("moveIdeaToTask", () => {
  it("converts the idea into a do task placed after the existing tasks", () => {
    const result = moveIdeaToTask(ideaFixture({ title: "memo", description: "body" }), [taskFixture({ order: 3 })]);

    if (!result.ok) throw new Error("expected a task");
    expect(result.value).toMatchObject({ title: "memo", description: "body", status: "do", order: 4 });
  });

  it("keeps the domain error for an idea without a title", () => {
    const result = moveIdeaToTask(ideaFixture({ title: "" }), []);

    if (result.ok) throw new Error("expected a failure");
    expect(result.error.code).toBe("INVALID_TITLE");
  });
});
