import type { McpTool } from "./types";
import { TASK_TOOLS } from "./tools-tasks";
import { PROJECT_TOOLS } from "./tools-projects";
import { IDEA_TOOLS } from "./tools-ideas";

/** Every MCP tool, in listing order. Handlers call the same repositories as the REST API. */
export const MCP_TOOLS: McpTool[] = [...TASK_TOOLS, ...PROJECT_TOOLS, ...IDEA_TOOLS];

export const MCP_SERVER_INFO = { name: "siftq", title: "SIFTQ", version: "1.0.0" } as const;

export const MCP_PROTOCOL_VERSION = "2025-06-18";

export function findTool(name: string): McpTool | undefined {
  return MCP_TOOLS.find((tool) => tool.name === name);
}

export type { McpTool, ToolContext, ToolResult } from "./types";
