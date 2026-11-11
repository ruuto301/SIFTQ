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
`;
