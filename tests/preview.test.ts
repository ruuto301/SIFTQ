// covers: BDD-TM-010
import { describe, expect, it } from "vite-plus/test";
import app from "../src/index";
import { SESSION_COOKIE_NAME, createSession } from "../src/auth";

const PREVIEW_SECRET = "preview-session-secret";

async function previewRequest(path: string): Promise<Response> {
  const session = await createSession(PREVIEW_SECRET, Date.now() + 60_000);
  return app.request(
    path,
    { headers: { Cookie: `${SESSION_COOKIE_NAME}=${session}` } },
    {
      PREVIEW_MODE: "true",
      SESSION_SECRET: PREVIEW_SECRET,
    },
  );
}

describe("mock backend preview", () => {
  it("renders the production Ideas, Task list and DS with fixed scenario data", async () => {
    const ideas = await previewRequest("/ideas");
    const ideasScript = await previewRequest("/idea.js");
    const list = await previewRequest("/tasks?status=done");
    const ds = await previewRequest("/ds");

    expect(ideas.status).toBe(200);
    const ideasBody = await ideas.text();
    expect(ideasBody).toContain("Ideas");
    expect(ideasBody).toContain("毎朝の振り返りを1分で終える");
    expect(ideasBody).toContain("資産の種類と共通点");
    expect(ideasBody).toContain('data-idea-page="true"');
    expect(ideasBody).toContain("メモを取る...");
    expect(ideasScript.status).toBe(200);
    expect(await ideasScript.text()).toContain("data-idea-page");
    expect(list.status).toBe(200);
    const listBody = await list.text();
    expect(listBody).toContain("完了したタスクの表示を確認する");
    expect(listBody).toContain("working");
    expect(listBody).toContain("#customer_portal");
    expect(ds.status).toBe(200);
    const dsBody = await ds.text();
    expect(dsBody).toContain("Yoriwake");
    expect(dsBody).toContain("data-ds-group-id");
  });

  it("redirects the removed Matrix route to the task list", async () => {
    const response = await previewRequest("/matrix");

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("/tasks");
  });

  it("redirects the old root path to Ideas", async () => {
    const response = await previewRequest("/");

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/ideas");
  });
});
