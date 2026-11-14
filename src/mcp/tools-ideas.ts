import { applyIdeaPatch, isIdeaDescriptionValid, isIdeaTitleValid, nextIdeaOrder, parseIdeaPatch, sortIdeas } from "../idea";
import type { Idea } from "../idea";
import { createTask, nextTaskOrder } from "../task";
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
    const rawTitle = readString(args, "title");
    const title = rawTitle === null ? "" : rawTitle.trim();
    if (!isIdeaTitleValid(title)) return errorContent("INVALID_TITLE", "title is required and must be within the limit");
    const description = readString(args, "description") ?? "";
    if (!isIdeaDescriptionValid(description)) return errorContent("INVALID_DESCRIPTION", "description is too long");
    const pinned = readOptionalBoolean(args, "pinned");
    if (args["pinned"] !== undefined && pinned === null) return errorContent("INVALID_INPUT", "pinned must be a boolean");
    const ideas = await loadIdeas(ctx);
    if (!Array.isArray(ideas)) return ideas;
    const idea: Idea = {
      id: crypto.randomUUID(),
      owner_id: OWNER_ID,
      title,
      description,
      order: nextIdeaOrder(ideas, pinned === true),
      pinned: pinned === true,
    };
    const inserted = await ctx.ideas.insert(idea);
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
    const id = readString(args, "id");
    if (id === null || id === "") return errorContent("INVALID_INPUT", "id is required");
    const found = await ctx.ideas.find(id, OWNER_ID);
    if (!found.ok) return errorContent(found.error.code, "failed to load the idea");
    if (found.value === undefined) return repositoryError("NOT_FOUND");
    const patch = parseIdeaPatch(args);
    if (!patch.ok) return errorContent(patch.error.code, "invalid update_idea arguments");
    const updated = await ctx.ideas.update(applyIdeaPatch(found.value, patch.value));
    if (!updated.ok) return repositoryError(updated.error.code);
    return jsonContent(updated.value);
  },
};

const deleteIdea: McpTool = {
  name: "delete_idea",
  description: "Delete an idea. This cannot be undone.",
  scope: "write",
  inputSchema: schema({ id: { type: "string" } }, ["id"]),
  handler: async (ctx, args) => {
    const id = readString(args, "id");
    if (id === null || id === "") return errorContent("INVALID_INPUT", "id is required");
    const removed = await ctx.ideas.remove(id, OWNER_ID);
    if (!removed.ok) return repositoryError(removed.error.code);
    return jsonContent({ deleted: id });
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
    const id = readString(args, "id");
    if (id === null || id === "") return errorContent("INVALID_INPUT", "id is required");
    const found = await ctx.ideas.find(id, OWNER_ID);
    if (!found.ok) return errorContent(found.error.code, "failed to load the idea");
    if (found.value === undefined) return repositoryError("NOT_FOUND");
    const tasks = await ctx.tasks.list();
    if (!tasks.ok) return errorContent(tasks.error.code, "failed to load tasks");
    const now = new Date().toISOString();
    const created = createTask({
      id: crypto.randomUUID(),
      owner_id: OWNER_ID,
      title: found.value.title,
      description: found.value.description,
      status: "do",
      created_at: now,
      updated_at: now,
    });
    if (!created.ok) return errorContent(created.error.code, "invalid idea");
    const inserted = await ctx.tasks.insert({ ...created.value, order: nextTaskOrder(tasks.value) });
    if (!inserted.ok) return errorContent(inserted.error.code, "failed to insert the task");
    const removed = await ctx.ideas.remove(id, OWNER_ID);
    if (!removed.ok) {
      await ctx.tasks.remove(inserted.value.id, OWNER_ID, inserted.value.version);
      return repositoryError(removed.error.code);
    }
    return jsonContent(inserted.value);
  },
};

export const IDEA_TOOLS: McpTool[] = [listIdeas, createIdea, updateIdea, deleteIdea, reorderIdeas, moveIdeaToTask];
