import { describe, expect, it } from "vite-plus/test";
import { renderMarkdown } from "../src/markdown";

describe("renderMarkdown blocks", () => {
  it("renders ATX headings from level 1 to 6", () => {
    expect(renderMarkdown("# One\n\n### Three\n\n###### Six")).toBe(
      "<h1>One</h1>\n<h3>Three</h3>\n<h6>Six</h6>",
    );
  });

  it("joins consecutive lines into one paragraph", () => {
    expect(renderMarkdown("first line\nsecond line")).toBe("<p>first line\nsecond line</p>");
  });

  it("renders thematic breaks", () => {
    expect(renderMarkdown("---\n\n***\n\n___")).toBe("<hr>\n<hr>\n<hr>");
  });

  it("renders fenced code as escaped preformatted text", () => {
    const source = ["```ts", "const value = 1 < 2;", "```"].join("\n");

    expect(renderMarkdown(source)).toBe(
      '<pre><code class="language-ts">const value = 1 &lt; 2;</code></pre>',
    );
  });

  it("renders an unterminated fence to the end of the source", () => {
    expect(renderMarkdown("```\nplain")).toBe("<pre><code>plain</code></pre>");
  });

  it("renders blockquotes with nested blocks", () => {
    expect(renderMarkdown("> quoted\n> **bold**")).toBe(
      "<blockquote>\n<p>quoted\n<strong>bold</strong></p>\n</blockquote>",
    );
  });
});

describe("renderMarkdown lists", () => {
  it("renders unordered lists", () => {
    expect(renderMarkdown("- one\n- two")).toBe("<ul>\n<li>one</li>\n<li>two</li>\n</ul>");
  });

  it("renders ordered lists with the first ordinal as start", () => {
    expect(renderMarkdown("3. three\n4. four")).toBe(
      '<ol start="3">\n<li>three</li>\n<li>four</li>\n</ol>',
    );
  });

  it("renders task list items with a disabled checkbox", () => {
    expect(renderMarkdown("- [ ] todo\n- [x] done")).toBe(
      [
        "<ul>",
        '<li class="task-list-item"><input type="checkbox" disabled> todo</li>',
        '<li class="task-list-item"><input type="checkbox" disabled checked> done</li>',
        "</ul>",
      ].join("\n"),
    );
  });
});

describe("renderMarkdown tables", () => {
  it("renders a pipe table with a header row", () => {
    const source = ["| name | value |", "| --- | --- |", "| a | 1 |", "| b | 2 |"].join("\n");

    expect(renderMarkdown(source)).toBe(
      [
        "<table>",
        "<thead>",
        "<tr><th>name</th><th>value</th></tr>",
        "</thead>",
        "<tbody>",
        "<tr><td>a</td><td>1</td></tr>",
        "<tr><td>b</td><td>2</td></tr>",
        "</tbody>",
        "</table>",
      ].join("\n"),
    );
  });

  it("accepts alignment markers and a missing leading pipe", () => {
    const source = ["name | value", ":--- | ---:", "a | 1"].join("\n");

    expect(renderMarkdown(source)).toBe(
      [
        "<table>",
        "<thead>",
        "<tr><th>name</th><th>value</th></tr>",
        "</thead>",
        "<tbody>",
        "<tr><td>a</td><td>1</td></tr>",
        "</tbody>",
        "</table>",
      ].join("\n"),
    );
  });
});

describe("renderMarkdown inline spans", () => {
  it("renders bold, italic and strikethrough", () => {
    expect(renderMarkdown("**bold** and *italic* and ~~gone~~")).toBe(
      "<p><strong>bold</strong> and <em>italic</em> and <del>gone</del></p>",
    );
  });

  it("keeps underscores inside words as text", () => {
    expect(renderMarkdown("snake_case_name")).toBe("<p>snake_case_name</p>");
  });

  it("renders inline code without processing its content", () => {
    expect(renderMarkdown("use `**literal** <b>` here")).toBe(
      "<p>use <code>**literal** &lt;b&gt;</code> here</p>",
    );
  });

  it("renders links with a safe rel attribute", () => {
    expect(renderMarkdown("[docs](https://example.com/a?b=1&c=2)")).toBe(
      '<p><a href="https://example.com/a?b=1&amp;c=2" rel="noopener noreferrer">docs</a></p>',
    );
  });

  it("renders http and https autolinks and keeps trailing punctuation", () => {
    expect(renderMarkdown("see https://example.com/docs.")).toBe(
      '<p>see <a href="https://example.com/docs" rel="noopener noreferrer">https://example.com/docs</a>.</p>',
    );
  });

  it("renders images with lazy loading", () => {
    expect(renderMarkdown("![shot](/api/images/abc-123)")).toBe(
      '<p><img src="/api/images/abc-123" alt="shot" loading="lazy"></p>',
    );
  });

  it("renders mailto links", () => {
    expect(renderMarkdown("[mail](mailto:dev@example.com)")).toBe(
      '<p><a href="mailto:dev@example.com" rel="noopener noreferrer">mail</a></p>',
    );
  });
});

describe("renderMarkdown sanitizing", () => {
  it("renders raw HTML as text", () => {
    expect(renderMarkdown('<script>alert("x")</script>')).toBe(
      "<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</p>",
    );
  });

  it("escapes HTML inside code blocks and code spans", () => {
    const source = ["```", "<script>alert(1)</script>", "```", "", "`<img onerror=x>`"].join("\n");

    expect(renderMarkdown(source)).toBe(
      '<pre><code>&lt;script&gt;alert(1)&lt;/script&gt;</code></pre>\n<p><code>&lt;img onerror=x&gt;</code></p>',
    );
  });

  it("rejects javascript URLs in links and images", () => {
    expect(renderMarkdown("[x](javascript:alert(1))")).toBe("<p>[x](javascript:alert(1))</p>");
    expect(renderMarkdown("![x](javascript:alert(1))")).toBe("<p>![x](javascript:alert(1))</p>");
  });

  it("rejects protocol-relative and data URLs", () => {
    expect(renderMarkdown("[x](//evil.example)")).toBe("<p>[x](//evil.example)</p>");
    expect(renderMarkdown("[x](data:text/html,<script>alert(1)</script>)")).toBe(
      "<p>[x](data:text/html,&lt;script&gt;alert(1)&lt;/script&gt;)</p>",
    );
  });

  it("does not autolink dangerous schemes", () => {
    expect(renderMarkdown("javascript:alert(1)")).toBe("<p>javascript:alert(1)</p>");
  });

  it("renders a URL encoded with an HTML entity as text", () => {
    expect(renderMarkdown('<a href="javascript:alert(1)">x</a>')).toBe(
      "<p>&lt;a href=&quot;javascript:alert(1)&quot;&gt;x&lt;/a&gt;</p>",
    );
  });
});
