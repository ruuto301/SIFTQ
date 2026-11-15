import { renderToString } from "hono/jsx/dom/server";
import { describe, expect, it } from "vite-plus/test";
import { Layout } from "../src/components/Layout";

describe("Layout", () => {
  it("renders an html document", () => {
    const html = renderToString(<Layout active="tasks"><span>content</span></Layout>);
    expect(html).toContain("<html");
    expect(html).toContain('id="page"');
    expect(html).toContain('src="/htmx-conflict.js"');
    expect(html).toContain('src="/popover-dismiss.js"');
    expect(html).toContain('src="/task-form-shortcut.js"');
    expect(html).toContain('src="/escape-cancel.js"');
  });

  it("declares an inline SVG favicon", () => {
    const html = renderToString(<Layout active="tasks"><span>content</span></Layout>);
    expect(html).toContain('rel="icon"');
    expect(html).toContain('type="image/svg+xml"');
    expect(html).toContain('href="data:image/svg+xml,');
  });

  it("orders the primary nav as Ideas, MK, Tasks, DS", () => {
    for (const active of ["ideas", "mk", "tasks", "ds"] as const) {
      const html = renderToString(<Layout active={active}><span>content</span></Layout>);
      const nav = html.slice(html.indexOf("<nav"), html.indexOf("</nav>"));
      const ideas = nav.indexOf('href="/ideas"');
      const mk = nav.indexOf('href="/mk"');
      const tasks = nav.indexOf('href="/tasks"');
      const ds = nav.indexOf('href="/ds"');
      expect(ideas).toBeGreaterThanOrEqual(0);
      expect(mk).toBeGreaterThanOrEqual(0);
      expect(tasks).toBeGreaterThanOrEqual(0);
      expect(ds).toBeGreaterThanOrEqual(0);
      expect(ideas).toBeLessThan(mk);
      expect(mk).toBeLessThan(tasks);
      expect(tasks).toBeLessThan(ds);
      expect(nav).toContain(`href="/${active}"`);
      expect(nav).not.toContain('href="/matrix"');
    }
  });
});
