import { renderToString } from "hono/jsx/dom/server";
import { describe, expect, it } from "vite-plus/test";
import { LoginCard, StandalonePage } from "../src/components/StandalonePage";

describe("StandalonePage", () => {
  it("renders the shared document head", () => {
    const html = renderToString(
      <StandalonePage>
        <p>body</p>
      </StandalonePage>,
    );

    expect(html).toContain('<html lang="ja">');
    expect(html).toContain('rel="icon"');
    expect(html).toContain('href="/styles.css"');
  });

  it("renders its children inside the body", () => {
    const html = renderToString(
      <StandalonePage>
        <p>body</p>
      </StandalonePage>,
    );

    expect(html).toContain("<p>body</p>");
  });
});

describe("LoginCard", () => {
  it("wraps the children in the centred login card", () => {
    const html = renderToString(
      <LoginCard>
        <h2>title</h2>
      </LoginCard>,
    );

    expect(html).toContain('class="login-card"');
    expect(html).toContain("<h2>title</h2>");
  });
});
