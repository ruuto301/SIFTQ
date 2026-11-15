import { renderToString } from "hono/jsx/dom/server";
import { describe, expect, it } from "vite-plus/test";
import { ConnectionsPage } from "../src/views/ConnectionsPage";

describe("ConnectionsPage", () => {
  it("lists connected clients with a revoke action", () => {
    const html = renderToString(
      <ConnectionsPage
        connections={[
          {
            clientId: "client-1",
            clientName: "Claude",
            redirectUris: ["https://client.example/callback"],
            activeTokens: 2,
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ]}
      />,
    );

    expect(html).toContain("Claude");
    expect(html).toContain("client-1");
    expect(html).toContain('value="client-1"');
    expect(html).toContain("失効");
  });

  it("shows an empty state", () => {
    const html = renderToString(<ConnectionsPage connections={[]} />);

    expect(html).toContain("連携しているアプリはありません。");
  });
});
