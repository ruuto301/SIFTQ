import { describe, expect, it } from "vite-plus/test";
import { STYLES_CSS } from "../src/styles";

/** Returns the declaration block for a rule, or an empty string when it is missing. */
function cssBlock(pattern: RegExp): string {
  return pattern.exec(STYLES_CSS)?.[0] ?? "";
}

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

  it("keeps the disabled DS composer button label visible", () => {
    const disabled = STYLES_CSS.match(/(?:^|\n)\.ds__new-add:disabled\s*\{[^}]*\}/);
    expect(disabled?.[0]).toContain("color: #8b949e;");
  });

  it("does not change the DS status tab colors on hover", () => {
    expect(STYLES_CSS).not.toContain(".ds__status-tabs .button.small:hover");
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
  it("draws each project as a bordered box that keeps its natural height", () => {
    const group = cssBlock(/(?:^|\n)\.ds__group\s*\{[^}]*\}/);
    expect(group).toContain("border: 2px solid #000;");
    expect(group).toContain("border-radius: 8px;");
    expect(group).toContain("overflow: hidden;");
    expect(group).toContain("gap: 0;");
    // `overflow: hidden` disables the automatic minimum height of a flex item, so the
    // box opts out of shrinking or an added task squashes the other projects.
    expect(group).toContain("flex: 0 0 auto;");
  });

  it("uses the header as the top edge and the count badge as an outline", () => {
    const head = cssBlock(/(?:^|\n)\.ds__group-head\s*\{[^}]*\}/);
    expect(head).toContain("background: #000;");
    expect(head).toContain("color: #fff;");
    expect(head).toContain("border: 0;");
    expect(head).toContain("border-radius: 0;");
    expect(head).toContain("cursor: pointer;");

    const count = cssBlock(/(?:^|\n)\.ds__group-count\s*\{[^}]*\}/);
    expect(count).toContain("background: transparent;");
    expect(count).toContain("border: 1px solid #8b949e;");
    expect(count).toContain("color: #fff;");
  });

  it("pads the framed body and drops the card shadow", () => {
    const tasks = cssBlock(/(?:^|\n)\.ds__tasks\s*\{[^}]*\}/);
    expect(tasks).toContain("padding: 8px;");

    const card = cssBlock(/(?:^|\n)\.ds__task\s*\{[^}]*\}/);
    expect(card).toContain("border: 1px solid #d8dde3;");
    expect(card).toContain("border-radius: 10px;");
    expect(card).not.toContain("box-shadow");
  });

  it("scrolls the group column", () => {
    const groups = cssBlock(/(?:^|\n)\.ds__groups\s*\{[^}]*\}/);
    expect(groups).toContain("overflow: auto;");
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

describe("unified palette", () => {
  it("puts the header on a white surface with a black outline", () => {
    const topbar = STYLES_CSS.match(/(?:^|\n)\.topbar\s*\{[^}]*\}/);
    expect(topbar?.[0]).toContain("background: #fff;");
    expect(topbar?.[0]).toContain("border: 1px solid #1b1f24;");
  });

  it("renders nav and buttons as black and white pills", () => {
    const button = STYLES_CSS.match(/(?:^|\n)\.nav a,\s*\n?\.button\s*\{[^}]*\}/);
    expect(button?.[0]).toContain("background: #fff;");
    expect(button?.[0]).toContain("border-radius: 999px;");
    const active = STYLES_CSS.match(/(?:^|\n)\.nav \.active,\s*\n?\.button\.primary\s*\{[^}]*\}/);
    expect(active?.[0]).toContain("background: #1b1f24;");
    const filter = STYLES_CSS.match(/(?:^|\n)\.task-status-filter \.button\.is-active\s*\{[^}]*\}/);
    expect(filter?.[0]).toContain("background: #1b1f24;");
  });

  it("keeps done and skip as outlined muted accents", () => {
    const done = STYLES_CSS.match(/(?:^|\n)\.status--done\s*\{[^}]*\}/);
    expect(done?.[0]).toContain("background: transparent;");
    expect(done?.[0]).toContain("border-color: #3f6b4f;");
    expect(done?.[0]).toContain("color: #2f4a38;");
    const skip = STYLES_CSS.match(/(?:^|\n)\.status--skip\s*\{[^}]*\}/);
    expect(skip?.[0]).toContain("border-color: #6b7280;");
  });

  it("uses white surfaces for the page, DS and login", () => {
    const ds = STYLES_CSS.match(/(?:^|\n)\.ds\s*\{[^}]*\}/);
    expect(ds?.[0]).toContain("background: #fff;");
    const login = STYLES_CSS.match(/(?:^|\n)\.login\s*\{[^}]*\}/);
    expect(login?.[0]).toContain("background: #fff;");
    const list = STYLES_CSS.match(/(?:^|\n)\.list\s*\{[^}]*\}/);
    expect(list?.[0]).toContain("background: #fff;");
  });

  it("no longer carries the old gray and green accents", () => {
    for (const stale of ["#1f883d", "#2a9147", "#b7e3c3", "#4ac26b", "#aeb8c4", "#e6e9ee", "#3b434d"]) {
      expect(STYLES_CSS, stale).not.toContain(stale);
    }
  });
});
