import { renderToString } from "hono/jsx/dom/server";
import { describe, expect, it } from "vite-plus/test";
import { DocumentHead } from "../src/components/DocumentHead";

describe("DocumentHead", () => {
  it("loads the reading fonts with a gorhom-safe preconnect", () => {
    const html = renderToString(<DocumentHead />);

    expect(html).toContain('rel="preconnect" href="https://fonts.googleapis.com"');
    expect(html).toContain('rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous"');
    expect(html).toContain("Atkinson+Hyperlegible");
    expect(html).toContain("Noto+Sans+JP");
  });

  it("keeps the brand metadata and renders the page assets", () => {
    const html = renderToString(
      <DocumentHead>
        <link rel="stylesheet" href="/styles.css" />
      </DocumentHead>,
    );

    expect(html).toContain("<title>Task Matrix</title>");
    expect(html).toContain('rel="icon"');
    expect(html).toContain('href="/styles.css"');
  });
});
