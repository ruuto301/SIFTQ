export const SETTINGS_CSS = `
/* Settings: project management list. */
.settings-section { margin: 18px 0 0; }
.settings-section__title { font-size: 15px; margin: 0 0 4px; }
.settings-section__hint { margin: 0 0 14px; font-size: 12px; color: #57606a; }
.settings-list { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
.settings-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 52px;
  padding: 10px 12px;
  border: 1px solid #d8dde3;
  border-radius: 10px;
  background: #fff;
}
.settings-row__name { flex: 1; min-width: 0; font-size: 14px; font-weight: 600; }
.settings-row__input {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 10px;
  border: 1px solid #1b1f24;
  border-radius: 8px;
  font: inherit;
  font-size: 14px;
}
.settings-row__id {
  flex: 0 0 auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  color: #8b949e;
}
.settings-row__count { flex: 0 0 auto; font-size: 12px; color: #57606a; }
.settings-row__actions { display: flex; gap: 6px; flex: 0 0 auto; }
.settings-none {
  margin: 10px 0 0;
  padding: 10px 12px;
  border: 1px dashed #8b949e;
  border-radius: 10px;
  font-size: 13px;
  color: #57606a;
}
.settings-add { display: flex; gap: 8px; margin: 16px 0 0; }
.settings-add input {
  flex: 1;
  min-width: 0;
  height: 34px;
  padding: 0 10px;
  border: 1px solid #d8dde3;
  border-radius: 8px;
  font: inherit;
  font-size: 13px;
}
.settings-error {
  margin: 10px 0 0;
  padding: 8px 12px;
  border: 1px solid #f3c2c2;
  border-radius: 8px;
  background: #fdf3f3;
  color: #b3261e;
  font-size: 12px;
}
.settings-error[hidden] { display: none; }
`;
