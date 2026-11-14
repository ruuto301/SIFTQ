import { describe, expect, it } from "vite-plus/test";
import { STYLES_CSS } from "../src/styles";

describe("styles", () => {
  it("defines the application shell, rows, cards and popover", () => {
    expect(STYLES_CSS).toContain(".topbar");
    expect(STYLES_CSS).toContain(".task-row");
    expect(STYLES_CSS).toContain(".task-card");
    expect(STYLES_CSS).toContain(".popover");
  });

  it("keeps the status and working badges in the shared theme", () => {
    expect(STYLES_CSS).toContain(".status--do");
    expect(STYLES_CSS).toContain(".status--done");
    expect(STYLES_CSS).toContain(".status--skip");
    expect(STYLES_CSS).toContain(".working-badge");
  });

  it("keeps the right side panel headings spaced from their controls", () => {
    const spaced = STYLES_CSS.match(/(?:^|\n)\.meta-row--spaced\s*\{[^}]*\}/);
    const sidePanel = STYLES_CSS.match(/(?:^|\n)\.side-panel > \.meta-row-link\s*\{[^}]*\}/);
    expect(spaced?.[0]).toContain("margin-bottom: 8px;");
    expect(sidePanel?.[0]).toContain("margin-bottom: 8px;");
  });

  it("styles the project label and the unassigned variant in a lighter tone", () => {
    const label = STYLES_CSS.match(/(?:^|\n)\.label\s*\{[^}]*\}/);
    const project = STYLES_CSS.match(/(?:^|\n)\.label--project\s*\{[^}]*\}/);
    const none = STYLES_CSS.match(/(?:^|\n)\.label--project-none\s*\{[^}]*\}/);
    expect(label?.[0]).toContain("border-radius: 999px;");
    expect(project?.[0]).toContain("color: #1b1f24;");
    expect(none?.[0]).toContain("color: #3f4854;");
    expect(STYLES_CSS).toContain(".project-select");
  });

  it("keeps the shared context menu and confirmation dialog styles", () => {
    expect(STYLES_CSS).toContain(".matrix-menu");
    expect(STYLES_CSS).toContain(".matrix-modal");
    expect(STYLES_CSS).toContain(".matrix-modal-backdrop");
  });

  it("does not keep the removed Matrix layout", () => {
    expect(STYLES_CSS).not.toContain(".matrix-axis");
    expect(STYLES_CSS).not.toContain(".area--quadrant");
    expect(STYLES_CSS).not.toContain(".axis-line");
  });
});

describe("styles regression guards", () => {
  it("stacks the side panel on narrow screens", () => {
    expect(STYLES_CSS).toMatch(
      /\.detail-grid\s*\{\s*display: grid;\s*gap: 16px;\s*grid-template-columns: minmax\(0, 1fr\);/,
    );
    expect(STYLES_CSS).toContain("@media (width >= 48rem)");
    expect(STYLES_CSS).toContain("grid-template-columns: minmax(0, 1fr) 250px;");
    expect(STYLES_CSS).toContain(".page--new .detail-grid");
    expect(STYLES_CSS).toContain(".page--detail .detail-grid");
  });

  it("keeps popovers within a narrow viewport", () => {
    expect(STYLES_CSS).toContain("width: min(360px, calc(100vw - 32px));");
    expect(STYLES_CSS).toContain("@media (width < 40rem)");
  });

  it("gives the task row link a single full-width column", () => {
    const link = STYLES_CSS.match(/(?:^|\n)\.task-row-link\s*\{[^}]*\}/);
    expect(link?.[0]).toContain("grid-template-columns: minmax(0, 1fr);");
    expect(link?.[0]).not.toContain("48px");
  });
});

describe("DS project groups", () => {
  it("lays out a scrollable group column with header bars and cards", () => {
    const groups = STYLES_CSS.match(/(?:^|\n)\.ds__groups\s*\{[^}]*\}/);
    expect(groups?.[0]).toContain("overflow: auto;");

    const head = STYLES_CSS.match(/(?:^|\n)\.ds__group-head\s*\{[^}]*\}/);
    expect(head?.[0]).toContain("border-radius: 8px;");
    expect(head?.[0]).toContain("background: #f6f8fa;");
    expect(head?.[0]).toContain("cursor: pointer;");

    const card = STYLES_CSS.match(/(?:^|\n)\.ds__task\s*\{[^}]*\}/);
    expect(card?.[0]).toContain("border-radius: 10px;");
  });

  it("hides the tasks and rotates the caret for a collapsed group", () => {
    expect(STYLES_CSS).toContain('.ds__group[data-collapsed="true"] .ds__tasks');
    expect(STYLES_CSS).toContain('.ds__group[data-collapsed="true"] .ds__group-caret');
  });

  it("defines the DS panes, resizers, settings and memo", () => {
    expect(STYLES_CSS).toContain(".ds__resizer");
    expect(STYLES_CSS).toContain(".ds--browser-max");
    expect(STYLES_CSS).toContain(".ds-settings__card");
    expect(STYLES_CSS).toContain(".ds__tab2");
    expect(STYLES_CSS).toContain(".dsh-desc");
    expect(STYLES_CSS).toContain(".ds__task-item");
    expect(STYLES_CSS).toContain(".ds__task-head");
    expect(STYLES_CSS).toContain(".dsh-card");
    expect(STYLES_CSS).toContain('.dsh-chat__send[data-state="stop"]');
  });
});

describe("Idea height cap", () => {
  it("caps the composer description at 672px and grows it with its content", () => {
    const rules = STYLES_CSS.match(/(?:^|\n)\.ideas-composer__description\s*\{[^}]*\}/g) ?? [];
    const description = rules.find((rule) => rule.includes("line-height: 1.55;"));
    expect(description).toContain("max-height: 672px;");
    expect(description).toContain("field-sizing: content;");
    expect(description).toContain("overflow-y: auto;");
  });

  it("caps the idea card at 672px and hides overflowing content", () => {
    const card = STYLES_CSS.match(/(?:^|\n)\.idea-card\s*\{[^}]*\}/);
    expect(card?.[0]).toContain("max-height: 672px;");
    expect(card?.[0]).toContain("overflow: hidden;");
  });
});

describe("Idea card description divider", () => {
  it("draws a top border above the description but not on empty cards", () => {
    const description = STYLES_CSS.match(/(?:^|\n)\.idea-card__description\s*\{[^}]*\}/);
    expect(description?.[0]).toContain("border-top: 1px solid #8b949e;");

    const empty = STYLES_CSS.match(/(?:^|\n)\.idea-card__description--empty\s*\{[^}]*\}/);
    expect(empty?.[0]).toContain("border-top: 0;");
  });
});

describe("Idea detail description divider", () => {
  it("draws a top border above the detail description but not when empty", () => {
    const description = STYLES_CSS.match(/(?:^|\n)\.idea-detail__description\s*\{[^}]*\}/g);
    const bordered = description?.find((rule) => rule.includes("border-top: 1px solid #8b949e;"));
    expect(bordered).toContain("border-top: 1px solid #8b949e;");
    expect(bordered).toContain("padding: 12px 0 0;");

    const empty = STYLES_CSS.match(/(?:^|\n)\.idea-detail__description--empty\s*\{[^}]*\}/);
    expect(empty?.[0]).toContain("border-top: 0;");
    expect(empty?.[0]).toContain("padding-top: 0;");
  });
});
