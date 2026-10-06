import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import process from "node:process";

const port = Number(process.env["GITHUB_MOCK_PORT"] ?? "4174");
const login = process.env["GITHUB_MOCK_LOGIN"] ?? "e2e-user";
const callback = process.env["GITHUB_MOCK_CALLBACK"] ?? "";

function sendJson(response: ServerResponse, body: unknown): void {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function handleAuthorize(url: URL, response: ServerResponse): void {
  const state = url.searchParams.get("state");
  const redirectUri = callback === "" ? url.searchParams.get("redirect_uri") : callback;
  if (redirectUri === null || state === null) {
    response.writeHead(400).end("missing redirect_uri or state");
    return;
  }
  const target = new URL(redirectUri);
  target.searchParams.set("code", "mock-code");
  target.searchParams.set("state", state);
  response.writeHead(302, { location: target.toString() }).end();
}

function handleRequest(request: IncomingMessage, response: ServerResponse): void {
  const url = new URL(request.url ?? "/", `http://localhost:${port}`);
  if (request.method === "GET" && url.pathname === "/login/oauth/authorize") {
    handleAuthorize(url, response);
    return;
  }
  if (request.method === "POST" && url.pathname === "/login/oauth/access_token") {
    sendJson(response, { access_token: "mock-access-token", token_type: "bearer" });
    return;
  }
  if (request.method === "GET" && url.pathname === "/user") {
    sendJson(response, { login });
    return;
  }
  response.writeHead(404).end("not found");
}

createServer(handleRequest).listen(port, "localhost");
