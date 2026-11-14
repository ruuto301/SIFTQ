import type { Env } from "../app-env";
import type { TaskRepository } from "../repository/task-repository";
import type { ProjectRepository } from "../repository/project-repository";
import type { IdeaRepository } from "../repository/idea-repository";

export type McpScope = "read" | "write";

/** Repositories the MCP tools operate on. They are the same ones the REST API uses. */
export type ToolContext = {
  env: Env;
  tasks: TaskRepository;
  projects: ProjectRepository;
  ideas: IdeaRepository;
};

export type ToolText = { type: "text"; text: string };

export type ToolResult = {
  content: ToolText[];
  isError?: boolean;
};

export type McpTool = {
  name: string;
  description: string;
  scope: McpScope;
  inputSchema: Record<string, unknown>;
  handler: (ctx: ToolContext, args: Record<string, unknown>) => Promise<ToolResult>;
};

/** Successful tool output: the JSON payload as a single text content block. */
export function jsonContent(value: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value) }] };
}

/** Domain failure: returned to the model with `isError` instead of an HTTP error. */
export function errorContent(code: string, message: string): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify({ code, message }) }], isError: true };
}

/** Maps a repository/domain error code to a tool error result. */
export function repositoryError(code: string): ToolResult {
  const message = code === "NOT_FOUND" ? "the target was not found" : "the task changed on the server; fetch it again";
  return errorContent(code, message);
}
