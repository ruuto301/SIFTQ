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

  it("styles the project label and the unassigned variant with outline tones", () => {
    const label = STYLES_CSS.match(/(?:^|\n)\.label\s*\{[^}]*\}/);
    const project = STYLES_CSS.match(/(?:^|\n)\.label--project\s*\{[^}]*\}/);
    const none = STYLES_CSS.match(/(?:^|\n)\.label--project-none\s*\{[^}]*\}/);
    expect(label?.[0]).toContain("border-radius: 999px;");
    expect(project?.[0]).toContain("color: #303030;");
    expect(none?.[0]).toContain("color: #555555;");
    expect(STYLES_CSS).toContain(".project-select");
  });

  it("keeps the shared context menu and confirmation dialog styles", () => {
    expect(STYLES_CSS).toContain(".matrix-menu");
    expect(STYLES_CSS).toContain(".matrix-modal");
    expect(STYLES_CSS).toContain(".matrix-modal-backdrop");
  });

  it("keeps the disabled DS composer button label visible", () => {
    const disabled = STYLES_CSS.match(/(?:^|\n)\.ds__new-add:disabled\s*\{[^}]*\}/);
    expect(disabled?.[0]).toContain("color: #8a8a8a;");
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
    expect(head).toContain("background: #d8d8d8;");
    expect(head).toContain("color: #303030;");
    expect(head).toContain("border: 2px solid #1f1f1f;");
    expect(head).toContain("border-radius: 0;");
    expect(head).toContain("cursor: pointer;");

    const count = cssBlock(/(?:^|\n)\.ds__group-count\s*\{[^}]*\}/);
    expect(count).toContain("background: transparent;");
    expect(count).toContain("border: 1px solid #bdbdbd;");
    expect(count).toContain("color: #555555;");
  });

  it("pads the framed body and drops the card shadow", () => {
    const tasks = cssBlock(/(?:^|\n)\.ds__tasks\s*\{[^}]*\}/);
    expect(tasks).toContain("padding: 8px;");

    const card = cssBlock(/(?:^|\n)\.ds__task\s*\{[^}]*\}/);
    expect(card).toContain("border: 2px solid #1f1f1f;");
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

  it("defines the DS panes, resizer and task detail", () => {
    expect(STYLES_CSS).toContain(".ds__resizer");
    expect(STYLES_CSS).toContain(".ds__pane {");
    expect(STYLES_CSS).toContain(".ds__pane--detail");
    expect(STYLES_CSS).toContain(".ds-task");
    expect(STYLES_CSS).toContain(".ds__task-item");
    expect(STYLES_CSS).toContain(".ds__task-head");
    expect(STYLES_CSS).toContain(".dsh-card");
  });

  it("drops the styles of the removed DS tab bar, chat, settings and browser panes", () => {
    for (const stale of [".ds--browser-max", ".ds-settings__card", ".ds__tab2", ".ds__tab.active", ".ds__pane--browser", ".ds__pane--chat", ".dsh-chat__send"]) {
      expect(STYLES_CSS, stale).not.toContain(stale);
    }
  });
});

describe("DS page width and resizer", () => {
  it("keeps the DS page full width without a max-width cap", () => {
    const pageFrame = cssBlock(/(?:^|\n)\.ds-page\s*\{[^}]*\}/);
    expect(pageFrame).toContain("width: 100%;");
    expect(pageFrame).not.toContain("max-width:");
    expect(pageFrame).not.toContain("margin: 0 auto;");
  });

  it("uses a 12px resizer column with a grip, tooltip and drag colour", () => {
    const ds = cssBlock(/(?:^|\n)\.ds\s*\{[^}]*\}/);
    expect(ds).toContain("var(--ds-left, 320px) 12px minmax(0, 1fr)");

    const resizer = cssBlock(/(?:^|\n)\.ds__resizer\s*\{[^}]*\}/);
    expect(resizer).toContain("cursor: col-resize;");
    expect(resizer).toContain("touch-action: none;");
    expect(STYLES_CSS).toContain(".ds__grip {");
    expect(STYLES_CSS).toContain(".ds__width-tag {");
    expect(STYLES_CSS).toContain(".ds__resizer:hover::before");
    expect(STYLES_CSS).toContain(".ds__resizer.dragging .ds__grip");
  });

  it("truncates task rows instead of stretching the layout", () => {
    const card = cssBlock(/(?:^|\n)\.ds__task\s*\{[^}]*\}/);
    expect(card).toContain("min-width: 0;");

    const title = cssBlock(/(?:^|\n)\.ds__task-title\s*\{[^}]*\}/);
    expect(title).toContain("text-overflow: ellipsis;");
  });

  it("falls back to a single pane below 900px and hides the resizer", () => {
    const media = STYLES_CSS.match(/@media \(max-width: 900px\)\s*\{[\s\S]*?\n\}/);
    expect(media?.[0]).toContain(".ds__resizer { display: none; }");
    expect(media?.[0]).toContain('.ds[data-ds-view="list"] .ds__pane--detail { display: none; }');
    expect(media?.[0]).toContain('.ds[data-ds-view="detail"] .ds__pane--tasks { display: none; }');
    expect(media?.[0]).toContain(".ds__back { display: inline-flex; }");
    expect(STYLES_CSS).not.toContain("@media (max-width: 1100px)");
  });
});

describe("unified palette", () => {
  it("puts the header on the page tone with a hairline outline", () => {
    const topbar = STYLES_CSS.match(/(?:^|\n)\.topbar\s*\{[^}]*\}/);
    expect(topbar?.[0]).toContain("background: #cccccc;");
    expect(topbar?.[0]).toContain("border: 1px solid #bdbdbd;");
  });

  it("renders nav and buttons as outlined pills with inverted active states", () => {
    const button = STYLES_CSS.match(/(?:^|\n)\.nav a,\s*\n?\.button\s*\{[^}]*\}/);
    expect(button?.[0]).toContain("background: #e4e4e4;");
    expect(button?.[0]).toContain("border-radius: 999px;");
    const active = STYLES_CSS.match(/(?:^|\n)\.nav \.active,\s*\n?\.button\.primary\s*\{[^}]*\}/);
    expect(active?.[0]).toContain("background: #262626;");
    const filter = STYLES_CSS.match(/(?:^|\n)\.task-status-filter \.button\.is-active\s*\{[^}]*\}/);
    expect(filter?.[0]).toContain("background: #262626;");
  });

  it("keeps done and skip as monochrome accents", () => {
    const done = STYLES_CSS.match(/(?:^|\n)\.status--done\s*\{[^}]*\}/);
    expect(done?.[0]).toContain("background: #262626;");
    expect(done?.[0]).toContain("border: 2px solid #dcdcdc;");
    expect(done?.[0]).toContain("color: #dcdcdc;");
    const skip = STYLES_CSS.match(/(?:^|\n)\.status--skip\s*\{[^}]*\}/);
    expect(skip?.[0]).toContain("border-color: #6b6b6b;");
  });

  it("uses the monochrome page and surface tones", () => {
    const ds = STYLES_CSS.match(/(?:^|\n)\.ds\s*\{[^}]*\}/);
    expect(ds?.[0]).toContain("background: #cccccc;");
    const login = STYLES_CSS.match(/(?:^|\n)\.login\s*\{[^}]*\}/);
    expect(login?.[0]).toContain("background: #cccccc;");
    const list = STYLES_CSS.match(/(?:^|\n)\.list\s*\{[^}]*\}/);
    expect(list?.[0]).toContain("background: #d8d8d8;");
  });

  it("no longer carries the old gray and green accents", () => {
    for (const stale of ["#1f883d", "#2a9147", "#b7e3c3", "#4ac26b", "#aeb8c4", "#e6e9ee", "#3b434d", "#2f6feb", "#eef4ff", "#f5f9ff", "#e8f0ff", "#c7d3e3"]) {
      expect(STYLES_CSS, stale).not.toContain(stale);
    }
  });
});

describe("Description preview tabs", () => {
  it("marks the selected tab and hides the inactive panel", () => {
    const selected = cssBlock(/(?:^|\n)\.description-tab\[aria-selected="true"\]\s*\{[^}]*\}/);
    expect(selected).toContain("background: #262626;");

    const hidden = cssBlock(/(?:^|\n)\.description-tabs__panel\[hidden\]\s*\{[^}]*\}/);
    expect(hidden).toContain("display: none;");
  });

  it("frames the rendered markdown like the description editor", () => {
    const preview = cssBlock(/(?:^|\n)\.description-preview\s*\{[^}]*\}/);
    expect(preview).toContain("border: 2px solid #1f1f1f;");
    expect(preview).toContain("overflow: auto;");
    expect(STYLES_CSS).toContain(".description-preview table");
    expect(STYLES_CSS).toContain(".description-preview pre");
  });

  it("sizes the DS description field around the tabs", () => {
    const field = cssBlock(/(?:^|\n)\.ds-task__description-field\s*\{[^}]*\}/);
    expect(field).toContain("flex: 1;");
    expect(field).toContain("min-height: 0;");
    expect(field).toContain("flex-direction: column;");
    expect(STYLES_CSS).toContain(".ds-task__description-field .description-tabs__panel");
  });
});
