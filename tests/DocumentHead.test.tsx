import { renderToString } from "hono/jsx/dom/server";
import { describe, expect, it } from "vite-plus/test";
import { DocumentHead } from "../src/components/DocumentHead";

describe("DocumentHead", () => {
  it("keeps the brand metadata without a third-party stylesheet", () => {
    const html = renderToString(<DocumentHead />);

    expect(html).toContain("<title>Task Matrix</title>");
    expect(html).toContain('rel="icon"');
    expect(html).not.toContain("fonts.googleapis.com");
  });

  it("renders the page assets", () => {
    const html = renderToString(
      <DocumentHead>
        <link rel="stylesheet" href="/styles.css" />
      </DocumentHead>,
    );

    expect(html).toContain('href="/styles.css"');
  });
});
