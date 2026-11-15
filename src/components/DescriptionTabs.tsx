export type DescriptionTab = "edit" | "preview";

const DESCRIPTION_TABS: readonly { tab: DescriptionTab; label: string }[] = [
  { tab: "edit", label: "編集" },
  { tab: "preview", label: "プレビュー" },
];

/** Detail screens open the rendered description; an empty description opens the editor. */
export function descriptionDefaultTab(description: string): DescriptionTab {
  return description.trim() === "" ? "edit" : "preview";
}

export function descriptionTabId(prefix: string, tab: DescriptionTab): string {
  return `${prefix}-tab-${tab}`;
}

export function descriptionPanelId(prefix: string, tab: DescriptionTab): string {
  return `${prefix}-panel-${tab}`;
}

/** Tab set shared by the task detail form and the DS description field. */
export function DescriptionTabList({ prefix, selected }: { prefix: string; selected: DescriptionTab }) {
  return (
    <div class="description-tabs" role="tablist" aria-label="Description view">
      {DESCRIPTION_TABS.map(({ tab, label }) => (
        <button
          key={tab}
          type="button"
          role="tab"
          id={descriptionTabId(prefix, tab)}
          class="description-tab"
          data-description-tab={tab}
          aria-controls={descriptionPanelId(prefix, tab)}
          aria-selected={tab === selected ? "true" : "false"}
          tabindex={tab === selected ? 0 : -1}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
