import {
  applyProjectPatch,
  nextProjectOrder,
  parseProjectCreate,
  parseProjectPatch,
} from "../project";
import type { Project } from "../project";
import { readOrderUpdates, readString, schema } from "./schema";
import { errorContent, jsonContent, repositoryError, type McpTool, type ToolContext, type ToolResult } from "./types";

async function loadProjects(ctx: ToolContext): Promise<Project[] | ToolResult> {
  const listed = await ctx.projects.list();
  if (!listed.ok) return errorContent(listed.error.code, "failed to load projects");
  return listed.value;
}

const listProjects: McpTool = {
  name: "list_projects",
  description: "List projects with their id, name, path, sort order and archived flag.",
  scope: "read",
  inputSchema: schema({}),
  handler: async (ctx) => {
    const projects = await loadProjects(ctx);
    return Array.isArray(projects) ? jsonContent(projects) : projects;
  },
};

const createProject: McpTool = {
  name: "create_project",
  description: "Create a project. id must match [A-Za-z0-9_-] and be unique.",
  scope: "write",
  inputSchema: schema(
    {
      id: { type: "string" },
      name: { type: "string" },
      path: { type: ["string", "null"] },
      archived: { type: "boolean" },
    },
    ["id", "name"],
  ),
  handler: async (ctx, args) => {
    const parsed = parseProjectCreate(args);
    if (!parsed.ok) return errorContent(parsed.error.code, "invalid create_project arguments");
    const projects = await loadProjects(ctx);
    if (!Array.isArray(projects)) return projects;
    const project: Project = {
      id: parsed.value.id,
      name: parsed.value.name,
      path: parsed.value.path,
      sort_order: nextProjectOrder(projects),
      archived: parsed.value.archived,
    };
    const inserted = await ctx.projects.insert(project);
    if (!inserted.ok) return repositoryError(inserted.error.code);
    return jsonContent(inserted.value);
  },
};

const updateProject: McpTool = {
  name: "update_project",
  description: "Update a project name, path or archived flag.",
  scope: "write",
  inputSchema: schema(
    {
      id: { type: "string" },
      name: { type: "string" },
      path: { type: ["string", "null"] },
      archived: { type: "boolean" },
    },
    ["id"],
  ),
  handler: async (ctx, args) => {
    const id = readString(args, "id");
    if (id === null || id === "") return errorContent("INVALID_INPUT", "id is required");
    const found = await ctx.projects.find(id);
    if (!found.ok) return errorContent(found.error.code, "failed to load the project");
    if (found.value === undefined) return repositoryError("NOT_FOUND");
    const patch = parseProjectPatch(args);
    if (!patch.ok) return errorContent(patch.error.code, "invalid update_project arguments");
    const updated = await ctx.projects.update(applyProjectPatch(found.value, patch.value));
    if (!updated.ok) return repositoryError(updated.error.code);
    return jsonContent(updated.value);
  },
};

const reorderProjects: McpTool = {
  name: "reorder_projects",
  description: "Replace the order of the given projects. Each entry needs id and order (1-based).",
  scope: "write",
  inputSchema: schema({ projects: { type: "array", items: { type: "object" } } }, ["projects"]),
  handler: async (ctx, args) => {
    const updates = readOrderUpdates(args["projects"]);
    if (updates === null) return errorContent("INVALID_INPUT", "projects must be a non-empty list of {id, order}");
    const moved = await ctx.projects.move(updates);
    if (!moved.ok) return repositoryError(moved.error.code);
    return jsonContent(moved.value);
  },
};

export const PROJECT_TOOLS: McpTool[] = [listProjects, createProject, updateProject, reorderProjects];
