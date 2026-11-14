import { applyIdeaPatch, isIdeaDescriptionValid, isIdeaTitleValid, parseIdeaPatch, sortIdeas } from "../idea";
import type { Idea } from "../idea";
import { createIdea as buildIdea, moveIdeaToTask as ideaToTask } from "../idea-tasks";
import { findById, isToolResult, readId, removeContent, updateContent } from "./helpers";
import { readOptionalBoolean, readOrderUpdates, readString, schema } from "./schema";
import { errorContent, jsonContent, repositoryError, type McpTool, type ToolContext, type ToolResult } from "./types";

const OWNER_ID = "local";

async function loadIdeas(ctx: ToolContext): Promise<Idea[] | ToolResult> {
  const listed = await ctx.ideas.list(OWNER_ID);
  if (!listed.ok) return errorContent(listed.error.code, "failed to load ideas");
  return listed.value;
}

const listIdeas: McpTool = {
  name: "list_ideas",
  description: "List ideas ordered by pinned and order.",
  scope: "read",
  inputSchema: schema({}),
  handler: async (ctx) => {
    const ideas = await loadIdeas(ctx);
    return Array.isArray(ideas) ? jsonContent(sortIdeas(ideas)) : ideas;
  },
};

const createIdea: McpTool = {
  name: "create_idea",
  description: "Create an idea (a memo that can later be turned into a task).",
  scope: "write",
  inputSchema: schema({ title: { type: "string" }, description: { type: "string" }, pinned: { type: "boolean" } }, ["title"]),
  handler: async (ctx, args) => {
    const title = (readString(args, "title") ?? "").trim();
    if (!isIdeaTitleValid(title)) return errorContent("INVALID_TITLE", "title is required and must be within the limit");
    const description = readString(args, "description") ?? "";
    if (!isIdeaDescriptionValid(description)) return errorContent("INVALID_DESCRIPTION", "description is too long");
    const pinned = readOptionalBoolean(args, "pinned");
    if (args["pinned"] !== undefined && pinned === null) return errorContent("INVALID_INPUT", "pinned must be a boolean");
    const ideas = await loadIdeas(ctx);
    if (!Array.isArray(ideas)) return ideas;
    const inserted = await ctx.ideas.insert(buildIdea(ideas, { title, description, pinned: pinned === true }));
    if (!inserted.ok) return errorContent(inserted.error.code, "failed to insert the idea");
    return jsonContent(inserted.value);
  },
};

const updateIdea: McpTool = {
  name: "update_idea",
  description: "Update an idea title, description, pinned flag or order.",
  scope: "write",
  inputSchema: schema(
    {
      id: { type: "string" },
      title: { type: "string" },
      description: { type: "string" },
      pinned: { type: "boolean" },
      order: { type: "integer" },
    },
    ["id"],
  ),
  handler: async (ctx, args) => {
    const found = await findById(args, "failed to load the idea", (id) => ctx.ideas.find(id, OWNER_ID));
    if (isToolResult(found)) return found;
    const patch = parseIdeaPatch(args);
    if (!patch.ok) return errorContent(patch.error.code, "invalid update_idea arguments");
    return updateContent(ctx.ideas.update(applyIdeaPatch(found, patch.value)));
  },
};

const deleteIdea: McpTool = {
  name: "delete_idea",
  description: "Delete an idea. This cannot be undone.",
  scope: "write",
  inputSchema: schema({ id: { type: "string" } }, ["id"]),
  handler: async (ctx, args) => {
    const id = readId(args);
    if (isToolResult(id)) return id;
    return removeContent(id, ctx.ideas.remove(id, OWNER_ID));
  },
};

const reorderIdeas: McpTool = {
  name: "reorder_ideas",
  description: "Replace the order of the given ideas. Each entry needs id and order (1-based).",
  scope: "write",
  inputSchema: schema({ ideas: { type: "array", items: { type: "object" } } }, ["ideas"]),
  handler: async (ctx, args) => {
    const updates = readOrderUpdates(args["ideas"]);
    if (updates === null) return errorContent("INVALID_INPUT", "ideas must be a non-empty list of {id, order}");
    const moved = await ctx.ideas.move(OWNER_ID, updates);
    if (!moved.ok) return repositoryError(moved.error.code);
    return jsonContent(sortIdeas(moved.value));
  },
};

const moveIdeaToTask: McpTool = {
  name: "move_idea_to_task",
  description: "Create a task from an idea and delete the idea.",
  scope: "write",
  inputSchema: schema({ id: { type: "string" } }, ["id"]),
  handler: async (ctx, args) => {
    const found = await findById(args, "failed to load the idea", (id) => ctx.ideas.find(id, OWNER_ID));
    if (isToolResult(found)) return found;
    const tasks = await ctx.tasks.list();
    if (!tasks.ok) return errorContent(tasks.error.code, "failed to load tasks");
    const task = ideaToTask(found, tasks.value);
    if (!task.ok) return errorContent(task.error.code, "invalid idea");
    const inserted = await ctx.tasks.insert(task.value);
    if (!inserted.ok) return errorContent(inserted.error.code, "failed to insert the task");
    const removed = await ctx.ideas.remove(found.id, OWNER_ID);
    if (!removed.ok) {
      await ctx.tasks.remove(inserted.value.id, OWNER_ID, inserted.value.version);
      return repositoryError(removed.error.code);
    }
    return jsonContent(inserted.value);
  },
};

export const IDEA_TOOLS: McpTool[] = [listIdeas, createIdea, updateIdea, deleteIdea, reorderIdeas, moveIdeaToTask];
