export const DS_CSS = `
/* DS page frame: full width; the shell below owns the two-pane grid. */
.ds-page {
  width: 100%;
}

/* DS shell: task list and selected task detail as cards on a gray page background. */
.ds {
  display: grid;
  grid-template-columns: var(--ds-left, 320px) 12px minmax(0, 1fr);
  gap: 10px;
  height: calc(100vh - 152px);
  padding: 10px;
  background: #cccccc;
  color: #303030;
}

.ds__pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  background: #d8d8d8;
  border: 2px solid #1f1f1f;
  border-radius: 12px;
  box-shadow: 0 1px 2px rgb(0 0 0 / 5%);
}

/* Narrow fallback: the back control returns from the detail to the task list. */
.ds__back {
  display: none;
  align-items: center;
  gap: 6px;
  margin: 10px 12px 0;
  padding: 5px 12px;
  border: 2px solid #1f1f1f;
  border-radius: 999px;
  background: #e4e4e4;
  color: #303030;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.ds__back:hover { background: #d8d8d8; }

.ds__pane-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid #bdbdbd;
  font-size: 12px;
  font-weight: 600;
  color: #303030;
}

.ds__resizer {
  position: relative;
  align-self: stretch;
  min-width: 0;
  border-radius: 6px;
  background: transparent;
  cursor: col-resize;
  touch-action: none;
}

.ds__resizer::before {
  content: "";
  position: absolute;
  inset: 0 5px;
  border-radius: 2px;
  background: #bdbdbd;
}

.ds__resizer:hover::before,
.ds__resizer.dragging::before,
.ds__resizer:focus-visible::before { background: #1f1f1f; }

.ds__grip {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 4px;
  height: 34px;
  transform: translate(-50%, -50%);
  border-radius: 2px;
  background-image: radial-gradient(#555555 1px, transparent 1.2px);
  background-size: 4px 5px;
  opacity: 0.7;
}

.ds__resizer:hover .ds__grip,
.ds__resizer.dragging .ds__grip,
.ds__resizer:focus-visible .ds__grip { opacity: 1; }

.ds__width-tag {
  position: absolute;
  top: 6px;
  left: 50%;
  transform: translateX(-50%);
  padding: 1px 6px;
  border-radius: 4px;
  background: #1f1f1f;
  color: #e4e4e4;
  font-size: 10.5px;
  line-height: 1.5;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 120ms ease;
  pointer-events: none;
}

.ds__resizer:hover .ds__width-tag,
.ds__resizer.dragging .ds__width-tag,
.ds__resizer:focus-visible .ds__width-tag { opacity: 1; }

/* Left pane: status pills and task cards. */
.ds__status-tabs {
  display: flex;
  gap: 6px;
  margin: 0;
  padding: 10px 12px 4px;
}

.ds__status-tabs .button.small {
  min-height: 28px;
  padding: 4px 14px;
  border: 2px solid #1f1f1f;
  border-radius: 999px;
  background: #e4e4e4;
  font-size: 12px;
  font-weight: 600;
  color: #303030;
}

.ds__status-tabs .button.is-active { background: #262626; border-color: #dcdcdc; color: #dcdcdc; }

/* Left pane: task composer. It sits outside the scrolling group list. */
.ds__new { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 4px 12px 16px; }
.ds__new-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
.ds__new-label { flex: 0 0 auto; font-size: 11px; color: #555555; }
.ds__new-hint { margin: 0; font-size: 11px; color: #555555; }
.ds__new-label--hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.ds__new-input {
  flex: 1;
  min-width: 0;
  height: 30px;
  padding: 0 10px;
  border: 2px solid #1f1f1f;
  border-radius: 8px;
  background: #e4e4e4;
  font: inherit;
  font-size: 12px;
  color: #303030;
}
.ds__new-input::placeholder { color: #555555; }
.ds__new-input:focus-visible { outline: 2px solid #1f1f1f; outline-offset: 2px; }
.ds__new-project {
  flex: 1;
  min-width: 0;
  height: 26px;
  padding: 0 6px;
  border: 2px solid #1f1f1f;
  border-radius: 8px;
  background: #e4e4e4;
  font: inherit;
  font-size: 11px;
  color: #303030;
}
.ds__new-project:focus-visible { outline: 2px solid #1f1f1f; outline-offset: 2px; }
.ds__new-add {
  flex: 0 0 auto;
  min-height: 30px;
  padding: 4px 12px;
  border: 2px solid #dcdcdc;
  border-radius: 8px;
  background: #262626;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  color: #dcdcdc;
  cursor: pointer;
}
.ds__new-add:hover:not(:disabled) { background: #303030; border-color: #dcdcdc; }
.ds__new-add:disabled { background: #e8e8e8; border-color: #bdbdbd; color: #8a8a8a; cursor: default; }
.ds__new-input:disabled,
.ds__new-project:disabled { background: #e8e8e8; border-color: #bdbdbd; color: #8a8a8a; }
.ds__new-error {
  margin: 0 12px 6px;
  padding: 6px 10px;
  border: 1px solid #1f1f1f;
  border-radius: 8px;
  background: #e8e8e8;
  color: #303030;
  font-size: 12px;
}
.ds__new-error[hidden] { display: none; }

.ds__groups {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 8px 12px 14px;
  overflow: auto;
}

/* Each project is a bordered box: the header is its top edge, the task list its body.
   The box opts out of flex shrinking so an added task extends it instead of
   squashing the other projects. */
.ds__group {
  display: flex;
  flex-direction: column;
  gap: 0;
  flex: 0 0 auto;
  border: 2px solid #000;
  border-radius: 8px;
  overflow: hidden;
  background: #d8d8d8;
}

.ds__groups-status {
  margin: 0 12px 6px;
  padding: 6px 10px;
  border: 1px solid #1f1f1f;
  border-radius: 8px;
  background: #e8e8e8;
  color: #303030;
  font-size: 12px;
}

.ds__groups-status[hidden] { display: none; }

.ds__group.dragging { opacity: 0.6; }
.ds__group--drop { outline: 2px dashed #1f1f1f; outline-offset: 2px; border-radius: 8px; }
.ds__group--drop-before { box-shadow: 0 -2px 0 0 #1f1f1f; }
.ds__group--drop-after { box-shadow: 0 2px 0 0 #1f1f1f; }

.ds__group-head {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  border: 2px solid #1f1f1f;
  border-radius: 0;
  background: #d8d8d8;
  font-size: 12px;
  font-weight: 600;
  text-align: left;
  color: #303030;
  cursor: pointer;
}

.ds__group-head:hover { background: #e4e4e4; }

.ds__group-caret { flex: 0 0 auto; transition: transform 120ms ease; }

.ds__group[data-collapsed="true"] .ds__group-caret { transform: rotate(-90deg); }
.ds__group[data-collapsed="true"] .ds__tasks { display: none; }

.ds__group-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ds__group-count {
  flex: 0 0 auto;
  padding: 1px 8px;
  border: 1px solid #bdbdbd;
  border-radius: 999px;
  background: transparent;
  font-size: 11px;
  font-weight: 600;
  color: #555555;
}

.ds__tasks {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 8px;
  list-style: none;
}

.ds__task-item { border: 0; min-width: 0; }
.ds__task-item.dragging { opacity: 0.5; }
.ds__task-item--drop-before { box-shadow: 0 -2px 0 0 #1f1f1f; }
.ds__task-item--drop-after { box-shadow: 0 2px 0 0 #1f1f1f; }

/* DS task context menu: header, status pills, value rows and dividers. */
.ds-menu__head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px 6px;
}

.ds-menu__title {
  font-size: 13px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ds-menu__meta {
  font-size: 11px;
  color: #555555;
}

.ds-menu__divider {
  height: 1px;
  background: #bdbdbd;
  margin: 4px 6px;
}

.ds-menu__label {
  padding: 4px 10px 2px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #555555;
}

.ds-menu__segment {
  display: flex;
  gap: 6px;
  padding: 2px 10px 8px;
}

.ds-menu__chip {
  flex: 1 1 0;
  padding: 5px 8px;
  border: 2px solid #1f1f1f;
  border-radius: 999px;
  background: #e4e4e4;
  color: #303030;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.ds-menu__chip:hover { background: #d8d8d8; }
.ds-menu__chip.is-active { background: #262626; border-color: #dcdcdc; color: #dcdcdc; }

.ds-menu__row {
  align-items: center;
  display: flex;
  gap: 8px;
  width: 100%;
}

.ds-menu__value {
  margin-left: auto;
  font-size: 11px;
  color: #555555;
}

.ds-menu__caret {
  margin-left: 4px;
  color: #555555;
}

.ds__task {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  min-height: 72px;
  padding: 12px;
  border: 2px solid #1f1f1f;
  border-radius: 10px;
  background: #d8d8d8;
  text-decoration: none;
  color: inherit;
}

.ds__task:hover { border-color: #1f1f1f; background: #e4e4e4; }
.ds__task.active { border-color: #1f1f1f; background: #e4e4e4; box-shadow: 0 0 0 2px rgb(0 0 0 / 12%); }
.ds__task.is-new { border-color: #1f1f1f; background: #dcdcdc; box-shadow: 0 0 0 3px rgb(0 0 0 / 18%); }
.ds__task-head { display: flex; align-items: flex-start; gap: 8px; min-width: 0; }
.ds__task-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.ds__task-meta { display: flex; align-items: center; gap: 6px; }
.ds__task-meta .working-badge { font-size: 11px; padding: 2px 8px; }

.ds__empty { padding: 18px 14px; font-size: 13px; color: #555555; }

/* Right pane: selected task detail. */
.ds__pane--detail { min-height: 0; }
.ds-task { flex: 1; min-height: 0; display: flex; flex-direction: column; background: #d8d8d8; }
.ds-task__body { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 4px; padding: 12px 16px 8px; }
.ds-task__label { font-size: 11px; font-weight: 700; color: #555555; }
.ds-task__title {
  height: 34px;
  padding: 0 10px;
  border: 2px solid #1f1f1f;
  border-radius: 8px;
  background: #e4e4e4;
  font: inherit;
  font-size: 13px;
  color: #303030;
}
.ds-task__description {
  flex: 1;
  min-height: 160px;
  padding: 10px 12px;
  border: 2px solid #1f1f1f;
  border-radius: 8px;
  background: #e4e4e4;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  line-height: 1.7;
  color: #303030;
  resize: none;
}
.ds-task__description-field {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ds-task__description-field .description-tabs__panel { gap: 4px; }
.ds-task__title:focus-visible,
.ds-task__description:focus-visible { outline: 2px solid #1f1f1f; outline-offset: 2px; }
.ds-task__foot { display: flex; align-items: center; gap: 10px; padding: 0 16px 12px; }
.ds-task__status { font-size: 11px; color: #555555; }
.ds-task__status--dirty { color: #1f1f1f; font-weight: 700; }
.ds-task__status--saving { color: #1f1f1f; font-weight: 700; }
.ds-task__status--saved { color: #555555; font-weight: 700; }
.ds-task__status--error { color: #1f1f1f; font-weight: 700; }
.ds-task__hint { font-size: 11px; color: #555555; }
.ds-task__save { margin-left: auto; }
.ds-task__error {
  margin: 0 16px 12px;
  padding: 8px 12px;
  border: 1px solid #1f1f1f;
  border-radius: 8px;
  background: #e8e8e8;
  color: #303030;
  font-size: 12px;
}
.ds-task__error[hidden] { display: none; }

.ds .button { color: #303030; border-radius: 8px; }
.ds .button.small { min-height: 28px; padding: 4px 12px; font-size: 12px; }

@media (max-width: 900px) {
  .ds {
    grid-template-columns: minmax(0, 1fr);
    height: auto;
  }

  .ds__resizer { display: none; }
  .ds[data-ds-view="list"] .ds__pane--detail { display: none; }
  .ds[data-ds-view="detail"] .ds__pane--tasks { display: none; }
  .ds__back { display: inline-flex; }
}
`;
