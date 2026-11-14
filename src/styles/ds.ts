export const DS_CSS = `
/* DS shell: three panes as cards on a light page background. */
.ds {
  display: grid;
  grid-template-columns: var(--ds-left, 300px) 8px minmax(0, 1fr) 8px var(--ds-right, 420px);
  gap: 10px;
  height: calc(100vh - 120px);
  padding: 10px;
  background: #f6f8fa;
  color: #1b1f24;
}

.ds__pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 1px 2px rgb(27 31 36 / 5%);
}

.ds__pane-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid #eef1f4;
  font-size: 12px;
  font-weight: 600;
  color: #1b1f24;
}

.ds__chat-title {
  padding: 8px 14px;
  border-bottom: 1px solid #eef1f4;
  background: #fafbfd;
}

.ds__chat-title__text {
  display: block;
  overflow-wrap: anywhere;
  white-space: normal;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
}

.ds__resizer {
  align-self: stretch;
  border-radius: 4px;
  background: transparent;
  cursor: col-resize;
  touch-action: none;
}

.ds__resizer:hover,
.ds__resizer.dragging { background: #cfe0ff; }

.ds.ds--browser-max { grid-template-columns: minmax(0, 1fr); }
.ds.ds--browser-max .ds__pane--tasks,
.ds.ds--browser-max .ds__pane--chat,
.ds.ds--browser-max .ds__resizer { display: none; }

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
  border: 1px solid #d8dde3;
  border-radius: 999px;
  background: #fff;
  font-size: 12px;
  font-weight: 600;
  color: #444d56;
}

.ds__status-tabs .button.is-active { background: #1b1f24; border-color: #1b1f24; color: #fff; }

/* Left pane: task composer. It sits outside the scrolling group list. */
.ds__new { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 4px 12px 16px; }
.ds__new-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
.ds__new-label { flex: 0 0 auto; font-size: 11px; color: #57606a; }
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
  border: 1px solid #d8dde3;
  border-radius: 8px;
  background: #fff;
  font: inherit;
  font-size: 12px;
  color: #1b1f24;
}
.ds__new-input::placeholder { color: #8b949e; }
.ds__new-input:focus-visible { border-color: #1b1f24; outline: 2px solid #e6e9ee; outline-offset: 1px; }
.ds__new-project {
  flex: 1;
  min-width: 0;
  height: 26px;
  padding: 0 6px;
  border: 1px solid #d8dde3;
  border-radius: 8px;
  background: #fff;
  font: inherit;
  font-size: 11px;
  color: #1b1f24;
}
.ds__new-project:focus-visible { border-color: #1b1f24; outline: 2px solid #e6e9ee; outline-offset: 1px; }
.ds__new-add {
  flex: 0 0 auto;
  min-height: 30px;
  padding: 4px 12px;
  border: 1px solid #1b1f24;
  border-radius: 8px;
  background: #1b1f24;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  cursor: pointer;
}
.ds__new-add:hover:not(:disabled) { background: #30363d; border-color: #30363d; }
.ds__new-add:disabled { background: #c1c9d3; border-color: #c1c9d3; cursor: default; }
.ds__new-input:disabled,
.ds__new-project:disabled { background: #f6f8fa; color: #8b949e; }
.ds__new-error {
  margin: 0 12px 6px;
  padding: 6px 10px;
  border: 1px solid #f3c2c2;
  border-radius: 8px;
  background: #fdf3f3;
  color: #b3261e;
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

.ds__group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ds__groups-status {
  margin: 0 12px 6px;
  padding: 6px 10px;
  border: 1px solid #f3c2c2;
  border-radius: 8px;
  background: #fdf3f3;
  color: #b3261e;
  font-size: 12px;
}

.ds__groups-status[hidden] { display: none; }

.ds__group.dragging { opacity: 0.6; }
.ds__group--drop { outline: 2px dashed #2f6feb; outline-offset: 2px; border-radius: 8px; }
.ds__group--drop-before { box-shadow: 0 -2px 0 0 #2f6feb; }
.ds__group--drop-after { box-shadow: 0 2px 0 0 #2f6feb; }

.ds__group-head {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f6f8fa;
  font-size: 12px;
  font-weight: 600;
  text-align: left;
  color: #1b1f24;
  cursor: pointer;
}

.ds__group-head:hover { background: #eef1f4; }

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
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: #fff;
  font-size: 11px;
  font-weight: 600;
  color: #57606a;
}

.ds__tasks {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ds__task-item { border: 0; }
.ds__task-item.dragging { opacity: 0.5; }
.ds__task-item--drop-before { box-shadow: 0 -2px 0 0 #2f6feb; }
.ds__task-item--drop-after { box-shadow: 0 2px 0 0 #2f6feb; }

.ds__task {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 72px;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  text-decoration: none;
  color: inherit;
  box-shadow: 0 1px 2px rgb(27 31 36 / 4%);
}

.ds__task:hover { border-color: #c7d3e3; background: #fafbfd; }
.ds__task.active { border-color: #2f6feb; background: #f5f9ff; box-shadow: 0 0 0 2px rgb(47 111 235 / 12%); }
.ds__task.is-new { border-color: #2f6feb; background: #eef4ff; box-shadow: 0 0 0 3px rgb(47 111 235 / 18%); }
.ds__task-head { display: flex; align-items: flex-start; gap: 8px; }
.ds__task-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.ds__task-meta { display: flex; align-items: center; gap: 6px; }
.ds__task-meta .status { font-size: 11px; padding: 2px 8px; }
.ds__task-meta .working-badge { font-size: 11px; padding: 2px 8px; }

.ds__dot { flex: 0 0 auto; width: 8px; height: 8px; margin-top: 6px; border-radius: 50%; }
.ds__dot--do { background: #2f6feb; }
.ds__dot--done { background: #2da44e; }
.ds__dot--skip { background: #8b949e; }

.ds__empty { padding: 18px 14px; font-size: 13px; color: #57606a; }

/* Center pane: tabs, toolbar and chat. */
.ds__tabs { display: flex; align-items: center; gap: 2px; }

.ds__tab {
  padding: 5px 10px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  font-size: 12px;
  font-weight: 600;
  color: #57606a;
  cursor: pointer;
}

.ds__tab:hover { background: #f3f6fa; }
.ds__tab.active { background: #eef4ff; color: #2f6feb; }

.ds__chat-tools { display: flex; align-items: center; gap: 6px; margin-left: auto; }
.ds__chat-tools select {
  max-width: 220px;
  padding: 4px 8px;
  border: 1px solid #d8dde3;
  border-radius: 999px;
  background: #fff;
  font-size: 12px;
  color: #1b1f24;
}

.ds__access { position: relative; }
.ds__pill {
  padding: 5px 10px;
  border: 1px solid #d8dde3;
  border-radius: 999px;
  background: #fff;
  font-size: 12px;
  color: #1b1f24;
  cursor: pointer;
}
.ds__pill:hover { background: #f3f6fa; }

.ds__menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 30;
  min-width: 190px;
  padding: 4px;
  border: 1px solid #d8dde3;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 8px 24px rgb(27 31 36 / 14%);
}
.ds__menu button {
  display: block;
  width: 100%;
  padding: 7px 9px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  font-size: 12px;
  text-align: left;
  color: #1b1f24;
  cursor: pointer;
}
.ds__menu button:hover { background: #eef4ff; }

.ds__pane--chat .dsh-chat { flex: 1; min-height: 0; gap: 0; max-width: none; margin: 0; padding: 0; }
.ds__pane--chat .dsh-chat__log { flex: 1; min-height: 0; max-height: none; border: 0; border-radius: 0; padding: 16px; gap: 12px; }
.ds__pane--chat .dsh-chat__usage { margin: 0; padding: 6px 16px; border-top: 1px solid #f1f3f5; }
.ds__pane--chat .dsh-chat__approval { margin: 0 16px 12px; }
.ds__pane--chat .dsh-chat__log:empty::before { content: "指示を入力して送信すると、ここに会話が表示されます。"; font-size: 13px; color: #8b949e; }
.ds__pane--chat .dsh-chat__form { padding: 10px 12px 12px; border-top: 1px solid #eef1f4; }

/* Description pane. */
.dsh-desc { flex: 1; min-height: 0; display: flex; flex-direction: column; background: #fff; }
.dsh-desc__bar { display: flex; align-items: center; gap: 8px; padding: 10px 16px 0; }
.dsh-desc__title { font-size: 12px; font-weight: 600; color: #57606a; }
.dsh-desc__view {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 12px 16px 20px;
  font-size: 13px;
  line-height: 1.8;
  color: #1b1f24;
  white-space: pre-wrap;
}
.dsh-desc__view:empty::before { content: "説明はまだありません。"; color: #8b949e; }
.dsh-desc__view .dsh-code { padding: 10px 12px; overflow: auto; border-radius: 8px; background: #f6f8fa; font-size: 12px; }
.dsh-desc__view code { padding: 1px 5px; border-radius: 5px; background: #f6f8fa; font-size: 12px; }
.dsh-chat[hidden], .dsh-desc[hidden] { display: none !important; }

/* Right pane: browser. */
.ds__pane--browser { min-height: 0; }
.ds__nav {
  width: 28px;
  height: 28px;
  border: 1px solid #d8dde3;
  border-radius: 8px;
  background: #fff;
  font-size: 12px;
  line-height: 1;
  color: #1b1f24;
  cursor: pointer;
}
.ds__nav:hover { background: #f3f6fa; }
.ds__max {
  white-space: nowrap;
  padding: 4px 12px;
  border: 1px solid #d8dde3;
  border-radius: 999px;
  background: #fff;
  font-size: 11px;
  color: #1b1f24;
  cursor: pointer;
}
.ds__max:hover { background: #f3f6fa; }
.ds__browser-status { margin-left: auto; font-size: 11px; color: #57606a; }
.ds__browser-bar { display: flex; gap: 6px; padding: 8px 10px; border-bottom: 1px solid #eef1f4; }
.ds__browser-bar input {
  flex: 1;
  min-width: 0;
  height: 30px;
  padding: 0 10px;
  border: 1px solid #d8dde3;
  border-radius: 8px;
  background: #fff;
  font-size: 12px;
  color: #1b1f24;
}
.ds__browser-bar .button { min-height: 30px; padding: 0 12px; border-radius: 8px; font-size: 12px; }
.ds__pane--browser canvas { flex: 1; width: 100%; height: 100%; min-height: 0; border: 0; background: #fff; outline: none; cursor: default; object-fit: contain; }
.ds__tabs-bar { display: flex; align-items: center; gap: 4px; padding: 6px 10px 0; overflow-x: auto; }
.ds__tab2 {
  display: flex;
  align-items: center;
  gap: 4px;
  max-width: 170px;
  padding: 4px 8px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f6f8fa;
  font-size: 11px;
  color: #444d56;
}
.ds__tab2.active { background: #eef4ff; border-color: #c7d3e3; color: #1b1f24; font-weight: 600; }
.ds__tab2-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
.ds__tab2-close { padding: 0 2px; border: 0; background: transparent; font-size: 11px; color: #8b949e; cursor: pointer; }
.ds__tab2-close:hover { color: #c62828; }
.ds__tab2-new { padding: 0 8px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; font-size: 13px; color: #57606a; cursor: pointer; }

/* Settings pane. */
.ds-settings { flex: 1; min-height: 0; display: flex; gap: 12px; padding: 12px; background: #fff; }
.ds-settings__ns { width: 180px; flex: 0 0 auto; display: flex; flex-direction: column; gap: 2px; overflow: auto; }
.ds-settings__ns-title { padding: 2px 8px 8px; font-size: 12px; font-weight: 600; color: #1b1f24; }
.ds-settings__ns-item { padding: 6px 8px; border: 0; border-radius: 8px; background: transparent; font-size: 12px; text-align: left; color: #444d56; cursor: pointer; }
.ds-settings__ns-item:hover { background: #f3f6fa; }
.ds-settings__ns-item.active { background: #eef4ff; color: #2f6feb; font-weight: 600; }
.ds-settings__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px; overflow: auto; }
.ds-settings__head { display: flex; align-items: center; gap: 10px; }
.ds-settings__title { font-size: 13px; font-weight: 600; color: #1b1f24; }
.ds-settings__status { margin-left: auto; font-size: 11px; color: #57606a; }
.ds-settings__form { display: flex; flex-direction: column; gap: 12px; }
.ds-settings__bar { display: flex; align-items: center; gap: 8px; }
.ds-settings__bar select,
.ds-settings__grid select,
.ds-settings__field input,
.ds-settings__key input {
  padding: 6px 9px;
  border: 1px solid #d8dde3;
  border-radius: 8px;
  background: #fff;
  font-size: 12px;
  color: #1b1f24;
}
.ds-settings__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.ds-settings__field { display: flex; flex-direction: column; gap: 3px; font-size: 11px; color: #57606a; }
.ds-settings__check { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #1b1f24; }
.ds-settings__key { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ds-settings__key input { flex: 0 0 220px; }
.ds-settings__key-label { font-size: 12px; color: #1b1f24; }
.ds-settings__key-state { font-size: 11px; color: #57606a; }
.ds-settings__models { display: flex; flex-direction: column; gap: 6px; }
.ds-settings__models-head { display: flex; align-items: center; gap: 10px; font-size: 12px; font-weight: 600; color: #1b1f24; }
.ds-settings__model-row { display: grid; grid-template-columns: 2fr 2fr 1fr auto; gap: 8px; align-items: end; }
.ds-settings__note { margin: 0; font-size: 11px; line-height: 1.7; color: #57606a; }
.ds-settings__json {
  flex: 1;
  min-height: 220px;
  width: 100%;
  padding: 10px;
  border: 1px solid #d8dde3;
  border-radius: 8px;
  background: #fff;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: #1b1f24;
}
.ds-settings[hidden], .ds-settings__json[hidden] { display: none !important; }
.ds-settings__block { display: flex; flex-direction: column; gap: 10px; padding: 12px; border: 1px solid #e5e7eb; border-radius: 10px; }
.ds-settings__block-title { font-size: 12px; font-weight: 600; color: #1b1f24; }
.ds-settings__cards { display: flex; flex-direction: column; gap: 6px; }
.ds-settings__card { display: flex; align-items: center; gap: 8px; padding: 9px 10px; border: 1px solid #e5e7eb; border-radius: 10px; background: #fff; }
.ds-settings__card:hover { border-color: #c7d3e3; }
.ds-settings__card.active { border-color: #2f6feb; background: #f5f9ff; }
.ds-settings__card-name { font-size: 13px; color: #1b1f24; }
.ds-settings__card-sub { font-size: 11px; color: #8b949e; }
.ds-settings__card-actions { margin-left: auto; display: flex; gap: 6px; }
.ds-settings__dot { flex: 0 0 auto; width: 8px; height: 8px; border-radius: 50%; background: #c1c9d3; }
.ds-settings__dot.good { background: #2da44e; }
.ds-settings__dot.bad { background: #d1242f; }
.ds-settings__hint { font-size: 10px; color: #8b949e; }
.ds-settings__link { padding: 0; border: 0; background: transparent; font-size: 11px; color: #2f6feb; cursor: pointer; }
.ds-settings__add { align-self: flex-start; }
.ds .button { color: #1b1f24; border-radius: 8px; }
.ds .button.small { min-height: 28px; padding: 4px 12px; font-size: 12px; }

/* Chat composer. */
.dsh-chat__send {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 1px solid #1b1f24;
  border-radius: 50%;
  background: #1b1f24;
  font-size: 15px;
  line-height: 1;
  color: #fff;
  cursor: pointer;
}
.dsh-chat__send:hover { background: #30363d; border-color: #30363d; }
.dsh-chat__send[data-state="stop"] { background: #fff; border-color: #d8dde3; color: #d1242f; }

@media (max-width: 1100px) {
  .ds:not(.ds--browser-max) { grid-template-columns: var(--ds-left, 240px) 8px minmax(0, 1fr); }
  .ds:not(.ds--browser-max) .ds__pane--browser,
  .ds:not(.ds--browser-max) .ds__resizer[data-resize="right"] { display: none; }
}
`;
