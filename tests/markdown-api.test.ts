import { describe, expect, it } from "vite-plus/test";
import app from "../src/index";
import { SESSION_COOKIE_NAME, createSession } from "../src/auth";
import { TASK_DESCRIPTION_MAX_CODE_POINTS } from "../src/task";

const SECRET = "markdown-api-test-secret";

function bindings() {
  return { SESSION_SECRET: SECRET };
}

async function request(body: string, authenticated = true) {
  const headers = new Headers({ "content-type": "application/json" });
  if (authenticated) {
    const session = await createSession(SECRET, Date.now() + 60_000);
    headers.set("Cookie", `${SESSION_COOKIE_NAME}=${session}`);
  }
  return app.request("/api/markdown/preview", { method: "POST", headers, body }, bindings());
}

async function preview(text: string): Promise<string> {
  const response = await request(JSON.stringify({ text }));
  expect(response.status).toBe(200);
  const body: { html: string } = await response.json();
  return body.html;
}

describe("Markdown preview API", () => {
  it("renders markdown text to html", async () => {
    const html = await preview("**bold**\n\n- one\n- two\n\n| a | b |\n| --- | --- |\n| 1 | 2 |");

    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<li>one</li>");
    expect(html).toContain("<th>a</th>");
    expect(html).toContain("<td>1</td>");
  });

  it("escapes raw HTML and dangerous URLs", async () => {
    const html = await preview('<script>alert("x")</script> [x](javascript:alert(1))');

    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(html).not.toContain("<script");
    expect(html).not.toContain('href="javascript:');
  });

  it("adds safe rel attributes to links", async () => {
    const html = await preview("[docs](https://example.com/docs)");

    expect(html).toContain('<a href="https://example.com/docs" rel="noopener noreferrer">docs</a>');
  });

  it("returns the same html for the same text", async () => {
    const text = "cached **preview** body";

    expect(await preview(text)).toBe(await preview(text));
  });

  it("rejects a body that is not a JSON object", async () => {
    const response = await request("not json");
    const body: { code: string } = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_INPUT");
  });

  it("rejects a body without a text string", async () => {
    const response = await request(JSON.stringify({ text: 42 }));
    const body: { code: string } = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_INPUT");
  });

  it("rejects text longer than the description limit", async () => {
    const response = await request(JSON.stringify({ text: "a".repeat(TASK_DESCRIPTION_MAX_CODE_POINTS + 1) }));
    const body: { code: string } = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_DESCRIPTION");
  });

  it("accepts text at the description limit", async () => {
    const response = await request(JSON.stringify({ text: "a".repeat(TASK_DESCRIPTION_MAX_CODE_POINTS) }));

    expect(response.status).toBe(200);
  });

  it("requires authentication", async () => {
    const response = await request(JSON.stringify({ text: "**bold**" }), false);

    expect(response.status).toBe(401);
  });
});
