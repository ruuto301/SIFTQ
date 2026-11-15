export const DSH_CHAT_CSS = `
.dsh-chat { display: flex; flex-direction: column; gap: 12px; max-width: 860px; margin: 0 auto; font-size: 13px; color: #303030; }
.dsh-chat__head-actions { display: flex; gap: 8px; align-items: center; }
.dsh-chat__state { font-size: 12px; color: #555555; }
.dsh-chat__title { margin: 0; font-weight: 600; }
.dsh-chat__usage { font-size: 11px; color: #555555; }
.dsh-chat__log {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 320px;
  max-height: 55vh;
  padding: 14px;
  overflow: auto;
  border: 2px solid #1f1f1f;
  border-radius: 10px;
  background: #d8d8d8;
}
.dsh-chat__line { white-space: pre-wrap; line-height: 1.75; }
.dsh-chat__line--user {
  align-self: flex-end;
  max-width: 82%;
  padding: 8px 12px;
  border-radius: 12px 12px 2px 12px;
  background: #e4e4e4;
  border: 2px solid #1f1f1f;
  color: #303030;
}
.dsh-chat__line--assistant { align-self: stretch; max-width: 100%; }
.dsh-chat__line--tool {
  align-self: flex-start;
  max-width: 100%;
  padding: 4px 8px;
  border: 1px solid #1f1f1f;
  border-radius: 8px;
  background: #e8e8e8;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  color: #555555;
}
.dsh-chat__error { padding: 8px 12px; border: 1px solid #1f1f1f; border-radius: 8px; background: #e8e8e8; font-size: 12px; color: #303030; }
.dsh-chat__approval { padding: 12px; border: 1px solid #1f1f1f; border-radius: 10px; background: #e8e8e8; }
.dsh-chat__approval-title { font-size: 13px; font-weight: 600; }
.dsh-chat__approval-detail { margin: 4px 0 10px; font-size: 12px; color: #555555; }
.dsh-chat__approval-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.dsh-chat__form { display: flex; flex-direction: column; gap: 8px; }
.dsh-chat__form textarea {
  width: 100%;
  min-height: 64px;
  padding: 10px 12px;
  border: 2px solid #1f1f1f;
  border-radius: 10px;
  background: #e4e4e4;
  font: inherit;
  line-height: 1.6;
  color: #303030;
  resize: vertical;
}
.dsh-chat__form textarea:focus { outline: 2px solid #1f1f1f; outline-offset: 2px; }
.dsh-chat__buttons { display: flex; justify-content: flex-end; }
.dsh-card {
  align-self: flex-start;
  max-width: 100%;
  padding: 6px 10px;
  border: 2px solid #1f1f1f;
  border-radius: 10px;
  background: #d8d8d8;
  font-size: 11px;
  color: #303030;
}
.dsh-card > summary { cursor: pointer; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; list-style: none; }
.dsh-card > summary::-webkit-details-marker { display: none; }
.dsh-card > summary::before { content: "▸ "; color: #555555; }
.dsh-card[open] > summary::before { content: "▾ "; }
.dsh-card--done { color: #1f1f1f; }
.dsh-card__body--done { color: #555555; }
.dsh-card pre {
  max-height: 220px;
  margin: 6px 0 0;
  padding: 8px;
  overflow: auto;
  border-radius: 8px;
  background: #e4e4e4;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  white-space: pre-wrap;
}
.dsh-code { padding: 10px 12px; overflow: auto; border: 2px solid #1f1f1f; border-radius: 8px; background: #e4e4e4; font-size: 12px; }
`;
