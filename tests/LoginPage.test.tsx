import { renderToString } from "hono/jsx/dom/server";
import { describe, expect, it } from "vite-plus/test";
import { LoginPage, safeNextPath } from "../src/components/LoginPage";

describe("LoginPage", () => {
  it("renders the GitHub sign-in link", () => {
    const html = renderToString(<LoginPage />);

    expect(html).toContain('href="/auth/github?next=%2Fideas"');
    expect(html).toContain("Sign in with GitHub");
  });

  it("shows an error when authentication fails", () => {
    const html = renderToString(<LoginPage error />);

    expect(html).toContain("GitHub sign-in failed");
  });

  it("declares an inline SVG favicon", () => {
    const html = renderToString(<LoginPage />);

    expect(html).toContain('rel="icon"');
    expect(html).toContain('type="image/svg+xml"');
    expect(html).toContain('href="data:image/svg+xml,');
  });
});

describe("safeNextPath", () => {
  it("keeps an internal path", () => {
    expect(safeNextPath("/tasks")).toBe("/tasks");
  });

  it("falls back for empty or external values", () => {
    expect(safeNextPath(undefined)).toBe("/ideas");
    expect(safeNextPath("https://example.com")).toBe("/ideas");
    expect(safeNextPath("//example.com")).toBe("/ideas");
  });
});
