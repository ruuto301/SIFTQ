export const DSH_CHAT_CSS = `
.dsh-chat { display: flex; flex-direction: column; gap: 12px; max-width: 860px; margin: 0 auto; font-size: 13px; color: #1b1f24; }
.dsh-chat__head-actions { display: flex; gap: 8px; align-items: center; }
.dsh-chat__state { font-size: 12px; color: #57606a; }
.dsh-chat__title { margin: 0; font-weight: 600; }
.dsh-chat__usage { font-size: 11px; color: #57606a; }
.dsh-chat__log {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 320px;
  max-height: 55vh;
  padding: 14px;
  overflow: auto;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fafbfc;
}
.dsh-chat__line { white-space: pre-wrap; line-height: 1.75; }
.dsh-chat__line--user {
  align-self: flex-end;
  max-width: 82%;
  padding: 8px 12px;
  border-radius: 12px 12px 2px 12px;
  background: #fff;
  border: 1px solid #1b1f24;
  color: #1b1f24;
}
.dsh-chat__line--assistant { align-self: stretch; max-width: 100%; }
.dsh-chat__line--tool {
  align-self: flex-start;
  max-width: 100%;
  padding: 4px 8px;
  border: 1px solid #d8dde3;
  border-radius: 8px;
  background: #fff;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  color: #57606a;
}
.dsh-chat__error { padding: 8px 12px; border: 1px solid #ffd7d5; border-radius: 8px; background: #fff5f5; font-size: 12px; color: #d1242f; }
.dsh-chat__approval { padding: 12px; border: 1px solid #f0c36d; border-radius: 10px; background: #fff8e1; }
.dsh-chat__approval-title { font-size: 13px; font-weight: 600; }
.dsh-chat__approval-detail { margin: 4px 0 10px; font-size: 12px; color: #57606a; }
.dsh-chat__approval-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.dsh-chat__form { display: flex; flex-direction: column; gap: 8px; }
.dsh-chat__form textarea {
  width: 100%;
  min-height: 64px;
  padding: 10px 12px;
  border: 1px solid #d8dde3;
  border-radius: 10px;
  background: #fff;
  font: inherit;
  line-height: 1.6;
  color: #1b1f24;
  resize: vertical;
}
.dsh-chat__form textarea:focus { border-color: #1b1f24; outline: none; box-shadow: 0 0 0 3px rgb(27 31 36 / 12%); }
.dsh-chat__buttons { display: flex; justify-content: flex-end; }
.dsh-card {
  align-self: flex-start;
  max-width: 100%;
  padding: 6px 10px;
  border: 1px solid #d8dde3;
  border-radius: 10px;
  background: #fff;
  font-size: 11px;
  color: #57606a;
}
.dsh-card > summary { cursor: pointer; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; list-style: none; }
.dsh-card > summary::-webkit-details-marker { display: none; }
.dsh-card > summary::before { content: "▸ "; color: #8b949e; }
.dsh-card[open] > summary::before { content: "▾ "; }
.dsh-card--done { color: #2da44e; }
.dsh-card__body--done { color: #57606a; }
.dsh-card pre {
  max-height: 220px;
  margin: 6px 0 0;
  padding: 8px;
  overflow: auto;
  border-radius: 8px;
  background: #fff;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  white-space: pre-wrap;
}
.dsh-code { padding: 10px 12px; overflow: auto; border: 1px solid #d8dde3; border-radius: 8px; background: #fff; font-size: 12px; }
`;
