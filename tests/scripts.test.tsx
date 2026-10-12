import { renderToString } from "hono/jsx/dom/server";
import { describe, expect, it } from "vite-plus/test";
import app from "../src/index";
import { CLIENT_ASSETS } from "../src/client/scripts";
import { Layout } from "../src/components/Layout";

describe("client asset registry", () => {
  it("serves every registered asset without authentication", async () => {
    for (const asset of CLIENT_ASSETS) {
      const response = await app.request(asset.path);
      expect(response.status, asset.path).toBe(200);
      expect(response.headers.get("content-type"), asset.path).toContain(asset.contentType);
      expect(await response.text(), asset.path).toBe(asset.body);
    }
  });

  it("loads every registered asset from Layout", () => {
    const html = renderToString(
      <Layout active="matrix">
        <span>content</span>
      </Layout>,
    );
    for (const asset of CLIENT_ASSETS) {
      if (asset.kind === "style") {
        expect(html, asset.path).toContain(`href="${asset.path}"`);
      } else {
        expect(html, asset.path).toContain(`src="${asset.path}"`);
      }
    }
  });

  it("keeps the description editor script public", async () => {
    const response = await app.request("/description-editor.js");

    expect(response.status).toBe(200);
  });
});
