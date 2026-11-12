export const DS_CSS = `
.ds { display: grid; grid-template-columns: var(--ds-left, 260px) 6px minmax(0, 1fr) 6px var(--ds-right, 380px); gap: 4px; height: calc(100vh - 120px); padding: 8px; }
.ds__resizer { cursor: col-resize; border-radius: 3px; background: transparent; align-self: stretch; touch-action: none; }
.ds__resizer:hover, .ds__resizer.dragging { background: #dbe6ff; }
.ds.ds--browser-max { grid-template-columns: minmax(0, 1fr); }
.ds.ds--browser-max .ds__pane--tasks, .ds.ds--browser-max .ds__pane--chat, .ds.ds--browser-max .ds__resizer { display: none; }
.ds__max { border: 1px solid #cfd6dd; background: #fff; border-radius: 6px; font-size: 11px; padding: 2px 8px; cursor: pointer; color: #1b1f24; }
.ds__pane { display: flex; flex-direction: column; min-height: 0; border: 1px solid rgba(127, 127, 127, 0.3); border-radius: 8px; overflow: hidden; }
.ds__pane-head { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; font-size: 12px; border-bottom: 1px solid rgba(127, 127, 127, 0.2); }
.ds__tasks { list-style: none; margin: 0; padding: 0; overflow: auto; flex: 1; }
.ds__task { display: flex; align-items: center; gap: 8px; padding: 8px 12px; text-decoration: none; color: inherit; border-bottom: 1px solid rgba(127, 127, 127, 0.1); }
.ds__task.active { background: rgba(80, 140, 255, 0.15); }
.ds__task-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ds__dot { width: 8px; height: 8px; border-radius: 50%; flex: 0 0 auto; }
.ds__dot--do { background: #4f8cff; }
.ds__dot--done { background: #3fb950; }
.ds__dot--skip { background: #8b949e; }
.ds__pane--chat .dsh-chat { flex: 1; min-height: 0; max-width: none; margin: 0; padding: 8px; gap: 8px; }
.ds__pane--chat .dsh-chat__log { flex: 1; min-height: 0; max-height: none; }
.ds__pane--chat .dsh-chat__form textarea { width: 100%; background: transparent; color: inherit; border: 1px solid rgba(127, 127, 127, 0.3); border-radius: 6px; padding: 8px; }
.ds__browser-bar { display: flex; gap: 6px; padding: 8px; border-bottom: 1px solid rgba(127, 127, 127, 0.2); }
.ds__browser-bar input { flex: 1; min-width: 0; padding: 6px 8px; border: 1px solid rgba(127, 127, 127, 0.3); border-radius: 6px; background: transparent; color: inherit; }
.ds__pane--browser canvas { flex: 1; width: 100%; height: 100%; min-height: 0; border: 0; background: #fff; outline: none; cursor: default; object-fit: contain; }
.ds__browser-status { font-size: 11px; color: #666; }
.ds__pane--browser { min-height: 0; }
.ds__empty { padding: 16px; opacity: 0.7; }
@media (max-width: 1100px) {
  .ds:not(.ds--browser-max) { grid-template-columns: var(--ds-left, 220px) 6px minmax(0, 1fr); }
  .ds:not(.ds--browser-max) .ds__pane--browser, .ds:not(.ds--browser-max) .ds__resizer[data-resize="right"] { display: none; }
}

/* DS white theme (scoped) */
.ds { background: #ffffff; color: #1b1f24; }
.ds__pane { background: #ffffff; border-color: #d8dde3; }
.ds__pane-head { background: #f6f8fa; border-color: #e5e7eb; color: #1b1f24; }
.ds__tasks { background: #ffffff; }
.ds__task { color: #1b1f24; border-color: #eef0f2; }
.ds__task.active { background: #eef4ff; }
.ds__task-title { color: #1b1f24; }
.ds__empty { color: #555; }
.ds .dsh-chat { color: #1b1f24; }
.ds .dsh-chat__log { background: #fafafa; border-color: #e5e7eb; }
.ds .dsh-chat__line--user { background: #e8f0ff; color: #1b1f24; }
.ds .dsh-chat__line--tool { color: #666; }
.ds .dsh-chat__usage { color: #444; }
.ds .dsh-chat__state { color: #555; }
.ds .dsh-chat__approval { background: #fff8e1; border-color: #f0c36d; color: #1b1f24; }
.ds .dsh-chat__approval-detail { color: #555; }
.ds .dsh-chat__form textarea { background: #ffffff; color: #1b1f24; border-color: #cfd6dd; }
.ds .ds__browser-bar input { background: #ffffff; color: #1b1f24; border-color: #cfd6dd; }
.ds__pane--browser iframe { background: #ffffff; }
.ds .button { color: #1b1f24; }

.ds__chat-tools { display: flex; gap: 6px; align-items: center; }
.ds__chat-tools select { font-size: 12px; padding: 4px 8px; border: 1px solid #cfd6dd; border-radius: 999px; background: #fff; color: #1b1f24; }
.ds__access { position: relative; }
.ds__pill { font-size: 12px; padding: 4px 10px; border: 1px solid #cfd6dd; border-radius: 999px; background: #fff; color: #1b1f24; cursor: pointer; }
.ds__menu { position: absolute; top: calc(100% + 4px); right: 0; z-index: 30; background: #fff; border: 1px solid #cfd6dd; border-radius: 8px; padding: 4px; min-width: 180px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12); }
.ds__menu button { display: block; width: 100%; padding: 6px 8px; border: 0; border-radius: 6px; background: transparent; color: #1b1f24; font-size: 12px; text-align: left; cursor: pointer; }
.ds__menu button:hover { background: #eef4ff; }

.ds__tabs { display: flex; gap: 4px; }
.ds__tab { border: 0; background: transparent; padding: 4px 8px; border-radius: 6px; cursor: pointer; font-size: 12px; color: #555; }
.ds__tab.active { background: #eef4ff; color: #1b1f24; font-weight: 600; }
.dsh-memo { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 8px; padding: 10px; background: #fff; }
.dsh-memo__bar { display: flex; align-items: center; gap: 8px; }
.dsh-memo__title { font-size: 12px; font-weight: 600; color: #1b1f24; }
.dsh-memo__status { margin-left: auto; font-size: 11px; color: #666; }
.dsh-memo__view { flex: 1; min-height: 0; overflow: auto; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; font-size: 13px; line-height: 1.7; color: #1b1f24; white-space: pre-wrap; }
.dsh-memo__view:empty:before { content: "メモはまだありません。「編集」から入力できます。"; color: #999; }
.dsh-memo__view .dsh-code { background: #f6f8fa; border-radius: 6px; padding: 8px; overflow: auto; font-size: 12px; }
.dsh-memo__view code { background: #f6f8fa; border-radius: 4px; padding: 1px 4px; font-size: 12px; }
.dsh-memo textarea { flex: 1; min-height: 0; width: 100%; resize: none; border: 1px solid #cfd6dd; border-radius: 6px; padding: 10px; font-size: 13px; line-height: 1.7; color: #1b1f24; background: #fff; }
.dsh-chat[hidden], .dsh-memo[hidden], .dsh-memo textarea[hidden] { display: none !important; }

.ds-settings { flex: 1; min-height: 0; display: flex; gap: 8px; padding: 8px; background: #fff; }
.ds-settings__ns { width: 170px; flex: 0 0 auto; overflow: auto; display: flex; flex-direction: column; gap: 2px; }
.ds-settings__ns-item { text-align: left; border: 0; background: transparent; padding: 5px 8px; border-radius: 6px; font-size: 12px; color: #333; cursor: pointer; }
.ds-settings__ns-item.active { background: #eef4ff; color: #1b1f24; font-weight: 600; }
.ds-settings__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; overflow: auto; }
.ds-settings__head { display: flex; align-items: center; gap: 8px; }
.ds-settings__title { font-size: 12px; font-weight: 600; color: #1b1f24; }
.ds-settings__status { margin-left: auto; font-size: 11px; color: #666; }
.ds-settings__form { display: flex; flex-direction: column; gap: 10px; }
.ds-settings__bar { display: flex; gap: 6px; align-items: center; }
.ds-settings__bar select { font-size: 12px; padding: 4px 8px; border: 1px solid #cfd6dd; border-radius: 6px; background: #fff; color: #1b1f24; }
.ds-settings__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.ds-settings__field { display: flex; flex-direction: column; gap: 2px; font-size: 11px; color: #555; }
.ds-settings__field input { padding: 5px 8px; border: 1px solid #cfd6dd; border-radius: 6px; background: #fff; color: #1b1f24; font-size: 12px; }
.ds-settings__check { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #333; }
.ds-settings__key { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.ds-settings__key input { flex: 0 0 200px; padding: 5px 8px; border: 1px solid #cfd6dd; border-radius: 6px; font-size: 12px; }
.ds-settings__key-label { font-size: 12px; color: #333; }
.ds-settings__key-state { font-size: 11px; color: #666; }
.ds-settings__models { display: flex; flex-direction: column; gap: 4px; }
.ds-settings__models-head { font-size: 12px; font-weight: 600; color: #1b1f24; }
.ds-settings__model-row { display: grid; grid-template-columns: 2fr 2fr 1fr auto; gap: 6px; align-items: end; }
.ds-settings__note { font-size: 11px; color: #666; }
.ds-settings__json { flex: 1; min-height: 220px; width: 100%; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; border: 1px solid #cfd6dd; border-radius: 6px; padding: 8px; color: #1b1f24; background: #fff; }
.ds-settings[hidden], .ds-settings__json[hidden] { display: none !important; }

.ds-settings__ns-title { font-size: 12px; font-weight: 600; color: #1b1f24; padding: 4px 8px 8px; }
.ds-settings__block { display: flex; flex-direction: column; gap: 8px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; }
.ds-settings__block-title { font-size: 12px; font-weight: 600; color: #1b1f24; }
.ds-settings__cards { display: flex; flex-direction: column; gap: 6px; }
.ds-settings__card { display: flex; align-items: center; gap: 8px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 10px; }
.ds-settings__card.active { border-color: #4f8cff; background: #f5f9ff; }
.ds-settings__card-name { font-size: 13px; color: #1b1f24; }
.ds-settings__card-sub { font-size: 11px; color: #777; }
.ds-settings__card-actions { margin-left: auto; display: flex; gap: 6px; }
.ds-settings__dot { width: 8px; height: 8px; border-radius: 50%; background: #bbb; flex: 0 0 auto; }
.ds-settings__dot.good { background: #3fb950; }
.ds-settings__dot.bad { background: #f85149; }
.ds-settings__hint { font-size: 10px; color: #999; }
.ds-settings__link { border: 0; background: transparent; color: #2368d8; cursor: pointer; font-size: 11px; padding: 0; }
.ds-settings__grid select { padding: 5px 8px; border: 1px solid #cfd6dd; border-radius: 6px; background: #fff; color: #1b1f24; font-size: 12px; }
.ds-settings__models-head { display: flex; align-items: center; gap: 10px; }
.ds-settings__add { align-self: flex-start; }

.ds__tabs { display: flex; align-items: center; gap: 2px; padding: 4px 6px 0; overflow-x: auto; border-bottom: 1px solid #e5e7eb; }
.ds__tab2 { display: flex; align-items: center; gap: 4px; max-width: 160px; padding: 3px 6px; border: 1px solid #e5e7eb; border-bottom: none; border-radius: 6px 6px 0 0; background: #f7f8fa; font-size: 11px; color: #333; }
.ds__tab2.active { background: #fff; border-color: #cfd6dd; font-weight: 600; }
.ds__tab2-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
.ds__tab2-close { border: 0; background: transparent; cursor: pointer; font-size: 11px; color: #777; padding: 0 2px; }
.ds__tab2-new { border: 0; background: transparent; cursor: pointer; font-size: 14px; color: #555; padding: 0 6px; }
.ds__nav { border: 1px solid #cfd6dd; background: #fff; border-radius: 6px; width: 26px; height: 26px; cursor: pointer; color: #1b1f24; font-size: 12px; line-height: 1; }
.ds__nav:hover { background: #eef4ff; }
`;
