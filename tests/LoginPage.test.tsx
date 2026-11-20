import { renderToString } from "hono/jsx/dom/server";
import { describe, expect, it } from "vite-plus/test";
import { LoginPage, safeNextPath } from "../src/components/LoginPage";

describe("LoginPage", () => {
  it("renders the GitHub sign-in link", () => {
    const html = renderToString(<LoginPage />);

    expect(html).toContain('href="/auth/github?next=%2Fideas"');
    expect(html).toContain("Sign in with GitHub");
  });

  it("returns the cause code and a retry action when authentication fails (BDD-TM-056)", () => {
    const html = renderToString(<LoginPage error="state_missing" />);

    expect(html).toContain("code: state_missing");
    expect(html).toContain("Cookie がブロックされている可能性");
    expect(html).toContain("もう一度ログイン");
    expect(html).toContain('href="/auth/github?next=%2Fideas"');
  });

  it("offers a reset action so one failure does not stick (BDD-TM-056)", () => {
    const html = renderToString(<LoginPage error="state_mismatch" />);

    expect(html).toContain('action="/auth/reset"');
    expect(html).toContain("ログインをリセット");
  });

  it("keeps the plain sign-in layout when there is no error", () => {
    const html = renderToString(<LoginPage />);

    expect(html).not.toContain("code:");
    expect(html).not.toContain('action="/auth/reset"');
  });

  it("offers account switch and GitHub logout for a rejected account (BDD-TM-057)", () => {
    const html = renderToString(<LoginPage error="not_allowed" />);

    expect(html).toContain('href="/auth/github?switch=1"');
    expect(html).toContain("別のアカウントでサインイン");
    expect(html).toContain('href="https://github.com/logout"');
    expect(html).toContain("シークレットウィンドウ");
  });

  it("stops offering the switch once attempts are exhausted (BDD-TM-057)", () => {
    const html = renderToString(<LoginPage error="switch_exhausted" />);

    expect(html).not.toContain('href="/auth/github?switch=1"');
    expect(html).toContain('href="https://github.com/logout"');
    expect(html).toContain("code: switch_exhausted");
  });

  it("does not show GitHub logout for unrelated failures", () => {
    const html = renderToString(<LoginPage error="state_expired" />);

    expect(html).not.toContain("github.com/logout");
  });

  it("uses a dedicated message for an expired state", () => {
    const html = renderToString(<LoginPage error="state_expired" />);

    expect(html).toContain("30分");
    expect(html).toContain("code: state_expired");
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
