export const DS_CSS = `
.ds { display: grid; grid-template-columns: 260px minmax(0, 1fr) 380px; gap: 8px; height: calc(100vh - 120px); padding: 8px; }
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
.ds__pane--browser iframe { flex: 1; width: 100%; border: 0; background: #fff; }
.ds__empty { padding: 16px; opacity: 0.7; }
@media (max-width: 1100px) {
  .ds { grid-template-columns: 220px minmax(0, 1fr); }
  .ds__pane--browser { display: none; }
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
.dsh-memo { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 6px; padding: 8px; background: #fff; }
.dsh-memo textarea { flex: 1; min-height: 0; width: 100%; resize: none; border: 1px solid #cfd6dd; border-radius: 6px; padding: 8px; font-size: 13px; line-height: 1.6; color: #1b1f24; background: #fff; }
.dsh-memo__status { font-size: 11px; color: #666; text-align: right; }
`;
