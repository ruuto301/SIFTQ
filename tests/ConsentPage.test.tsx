import { renderToString } from "hono/jsx/dom/server";
import { describe, expect, it } from "vite-plus/test";
import { ConsentPage } from "../src/views/ConsentPage";

describe("ConsentPage", () => {
  it("names the client and the requested scopes", () => {
    const html = renderToString(
      <ConsentPage
        clientName="Claude"
        scopes={["read", "write"]}
        params={{ client_id: "client-1", redirect_uri: "https://client.example/callback" }}
      />,
    );

    expect(html).toContain("Claude");
    expect(html).toContain("タスクの閲覧");
    expect(html).toContain("タスクの作成・更新・削除（削除を含む）");
    expect(html).toContain('name="decision"');
  });

  it("posts the authorization parameters back to the server", () => {
    const html = renderToString(
      <ConsentPage
        clientName="Cursor"
        scopes={["read"]}
        params={{ client_id: "client-2", state: "state-1" }}
      />,
    );

    expect(html).toContain('value="client-2"');
    expect(html).toContain('value="state-1"');
  });
});
