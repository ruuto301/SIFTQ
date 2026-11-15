import { renderToString } from "hono/jsx/dom/server";
import { describe, expect, it } from "vite-plus/test";
import {
  DescriptionTabList,
  descriptionDefaultTab,
  descriptionPanelId,
  descriptionTabId,
} from "../src/components/DescriptionTabs";

describe("descriptionDefaultTab", () => {
  it("opens the editor for an empty description and the preview otherwise", () => {
    expect(descriptionDefaultTab("")).toBe("edit");
    expect(descriptionDefaultTab("   \n  ")).toBe("edit");
    expect(descriptionDefaultTab("# 見出し")).toBe("preview");
  });
});

describe("description id helpers", () => {
  it("prefixes tab and panel ids so task and DS screens can coexist", () => {
    expect(descriptionTabId("ds-description", "edit")).toBe("ds-description-tab-edit");
    expect(descriptionPanelId("ds-description", "preview")).toBe("ds-description-panel-preview");
  });
});

describe("DescriptionTabList", () => {
  it("renders the 編集 / プレビュー tablist with the selected tab marked", () => {
    const html = renderToString(<DescriptionTabList prefix="ds-description" selected="preview" />);

    expect(html).toContain('role="tablist"');
    expect(html).toContain('data-description-tab="edit"');
    expect(html).toContain('data-description-tab="preview"');
    expect(html).toContain('id="ds-description-tab-edit"');
    expect(html).toContain('aria-controls="ds-description-panel-preview"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('tabindex="-1"');
  });
});
