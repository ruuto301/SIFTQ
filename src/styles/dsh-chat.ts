export const DSH_CHAT_CSS = `
.dsh-chat { display: flex; flex-direction: column; gap: 12px; max-width: 860px; margin: 0 auto; }
.dsh-chat__head-actions { display: flex; gap: 8px; align-items: center; }
.dsh-chat__state { font-size: 12px; opacity: 0.7; }
.dsh-chat__title { font-weight: 600; margin: 0; }
.dsh-chat__usage { font-size: 12px; opacity: 0.8; }
.dsh-chat__log { min-height: 320px; max-height: 55vh; overflow: auto; border: 1px solid rgba(127, 127, 127, 0.3); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.dsh-chat__line { white-space: pre-wrap; line-height: 1.5; }
.dsh-chat__line--user { align-self: flex-end; background: rgba(80, 140, 255, 0.15); border-radius: 8px; padding: 6px 10px; max-width: 85%; }
.dsh-chat__line--assistant { align-self: flex-start; max-width: 85%; }
.dsh-chat__line--tool { font-size: 12px; opacity: 0.6; }
.dsh-chat__approval { border: 1px solid rgba(255, 180, 0, 0.5); border-radius: 8px; padding: 10px; }
.dsh-chat__approval-detail { font-size: 12px; opacity: 0.8; margin: 4px 0 8px; }
.dsh-chat__approval-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.dsh-chat__form { display: flex; flex-direction: column; gap: 8px; }
.dsh-chat__form textarea { width: 100%; resize: vertical; }
.dsh-chat__buttons { display: flex; justify-content: flex-end; }
`;
