import {
  applyProjectPatch,
  nextProjectOrder,
  parseProjectCreate,
  parseProjectPatch,
} from "../project";
import type { Project } from "../project";
import { findById, isToolResult, updateContent } from "./helpers";
import { readOrderUpdates, schema } from "./schema";
import { errorContent, jsonContent, repositoryError, type McpTool, type ToolContext, type ToolResult } from "./types";

const PROJECT_PROPERTIES = {
  id: { type: "string" },
  name: { type: "string" },
  path: { type: ["string", "null"] },
  archived: { type: "boolean" },
};

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
  inputSchema: schema(PROJECT_PROPERTIES, ["id", "name"]),
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
  inputSchema: schema(PROJECT_PROPERTIES, ["id"]),
  handler: async (ctx, args) => {
    const found = await findById(args, "failed to load the project", (id) => ctx.projects.find(id));
    if (isToolResult(found)) return found;
    const patch = parseProjectPatch(args);
    if (!patch.ok) return errorContent(patch.error.code, "invalid update_project arguments");
    return updateContent(ctx.projects.update(applyProjectPatch(found, patch.value)));
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
