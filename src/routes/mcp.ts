import type { Context, Hono } from "hono";
import type { AppEnv } from "../app-env";
import { MCP_PROTOCOL_VERSION, MCP_SERVER_INFO, MCP_TOOLS, findTool } from "../mcp";
import { isArgs } from "../mcp/schema";
import type { ToolContext } from "../mcp/types";
import { oauthChallenge, recordMcpAudit, verifyMcpToken } from "../oauth";
import type { TaskRepository } from "../repository/task-repository";
import type { ProjectRepository } from "../repository/project-repository";
import type { IdeaRepository } from "../repository/idea-repository";

type RepositoryFactory<T> = (c: Context<AppEnv>) => T;

const JSON_RPC_INVALID_REQUEST = -32600;
const JSON_RPC_METHOD_NOT_FOUND = -32601;
const JSON_RPC_INVALID_PARAMS = -32602;
const JSON_RPC_INTERNAL_ERROR = -32603;
const JSON_RPC_UNAUTHORIZED = -32001;
const JSON_RPC_INSUFFICIENT_SCOPE = -32003;

function rpcResult(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

function toolListResult() {
  return {
    tools: MCP_TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: { readOnlyHint: tool.scope === "read", destructiveHint: tool.name.startsWith("delete") || tool.name.startsWith("bulk_delete") },
    })),
  };
}

function initializeResult() {
  return {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: { tools: { listChanged: false } },
    serverInfo: MCP_SERVER_INFO,
  };
}

function handleNotification(c: Context<AppEnv>) {
  return c.body(null, 202);
}

async function handleToolCall(
  c: Context<AppEnv>,
  id: unknown,
  params: unknown,
  ctx: ToolContext,
  clientId: string,
  scopes: readonly string[],
) {
  if (!isArgs(params) || typeof params["name"] !== "string") {
    return c.json(rpcError(id, JSON_RPC_INVALID_PARAMS, "params.name is required"), 200);
  }
  const name = params["name"];
  const tool = findTool(name);
  if (tool === undefined) {
    return c.json(rpcError(id, JSON_RPC_INVALID_PARAMS, `unknown tool: ${name}`), 200);
  }
  if (tool.scope === "write" && !scopes.includes("write")) {
    c.header("WWW-Authenticate", oauthChallenge(c));
    return c.json(rpcError(id, JSON_RPC_INSUFFICIENT_SCOPE, "insufficient scope: write is required"), 403);
  }
  const args = isArgs(params["arguments"]) ? params["arguments"] : {};
  const result = await tool.handler(ctx, args);
  const target = typeof args["id"] === "string" ? args["id"] : null;
  await recordMcpAudit(c.env, { clientId, tool: name, target, status: result.isError === true ? "error" : "ok" });
  return c.json(rpcResult(id, result), 200);
}

async function handleRpc(
  c: Context<AppEnv>,
  body: unknown,
  ctx: ToolContext,
  clientId: string,
  scopes: readonly string[],
): Promise<Response> {
  if (!isArgs(body) || typeof body["method"] !== "string") {
    return c.json(rpcError(null, JSON_RPC_INVALID_REQUEST, "a JSON-RPC request object is required"), 200);
  }
  const id = body["id"];
  const method = body["method"];
  const params = body["params"];
  if (method.startsWith("notifications/")) return handleNotification(c);
  if (method === "initialize") return c.json(rpcResult(id, initializeResult()), 200);
  if (method === "ping") return c.json(rpcResult(id, {}), 200);
  if (method === "tools/list") return c.json(rpcResult(id, toolListResult()), 200);
  if (method === "tools/call") return handleToolCall(c, id, params, ctx, clientId, scopes);
  return c.json(rpcError(id, JSON_RPC_METHOD_NOT_FOUND, `unknown method: ${method}`), 200);
}

/** 401 response for MCP clients: JSON-RPC error plus the OAuth challenge header. */
export function mcpUnauthorized(c: Context<AppEnv>): Response {
  c.header("WWW-Authenticate", oauthChallenge(c));
  return c.json(rpcError(null, JSON_RPC_UNAUTHORIZED, "a valid OAuth access token is required"), 401);
}

/**
 * Registers POST /mcp (Streamable HTTP, stateless). The global middleware lets the request through only
 * when the OAuth access token is valid.
 */
export function registerMcpRoutes(
  app: Hono<AppEnv>,
  repository: RepositoryFactory<TaskRepository>,
  projectRepository: RepositoryFactory<ProjectRepository>,
  ideaRepository: RepositoryFactory<IdeaRepository>,
) {
  app.get("/mcp", (c) => c.body(null, 405, { allow: "POST" }));

  app.post("/mcp", async (c) => {
    const info = await verifyMcpToken(c.env, c.req.header("authorization"));
    if (info === null) {
      c.header("WWW-Authenticate", oauthChallenge(c));
      return c.json(rpcError(null, JSON_RPC_UNAUTHORIZED, "a valid OAuth access token is required"), 401);
    }
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(rpcError(null, JSON_RPC_INVALID_REQUEST, "the request body must be JSON"), 400);
    }
    const ctx: ToolContext = {
      env: c.env,
      tasks: repository(c),
      projects: projectRepository(c),
      ideas: ideaRepository(c),
    };
    try {
      return await handleRpc(c, body, ctx, info.clientId, info.scopes);
    } catch {
      return c.json(rpcError(null, JSON_RPC_INTERNAL_ERROR, "the tool call failed"), 200);
    }
  });
}
