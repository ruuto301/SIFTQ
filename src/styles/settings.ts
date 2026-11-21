export const SETTINGS_CSS = `
/* Settings: project management list. */
.settings-section { margin: 18px 0 0; }
.settings-section__title { font-size: 15px; margin: 0 0 4px; }
.settings-section__hint { margin: 0 0 14px; font-size: 12px; color: #555555; }
.settings-list { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
.settings-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 52px;
  padding: 10px 12px;
  border: 2px solid #1f1f1f;
  border-radius: 10px;
  background: #d8d8d8;
}
.settings-row__name { flex: 1; min-width: 0; font-size: 14px; font-weight: 600; }
.settings-row__input {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 10px;
  border: 2px solid #1f1f1f;
  border-radius: 8px;
  background: #e4e4e4;
  color: #303030;
  font: inherit;
  font-size: 14px;
}
.settings-row__id {
  flex: 0 0 auto;
  min-width: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  color: #555555;
}
.settings-row__count { flex: 0 0 auto; font-size: 12px; color: #555555; }
.settings-row__actions { display: flex; gap: 6px; flex: 0 0 auto; }
.settings-none {
  margin: 10px 0 0;
  padding: 10px 12px;
  border: 1px dashed #bdbdbd;
  border-radius: 10px;
  font-size: 13px;
  color: #555555;
}
.settings-add { display: flex; gap: 8px; margin: 16px 0 0; }
.settings-add input {
  flex: 1;
  min-width: 0;
  height: 34px;
  padding: 0 10px;
  border: 2px solid #1f1f1f;
  border-radius: 8px;
  background: #e4e4e4;
  color: #303030;
  font: inherit;
  font-size: 13px;
}
.settings-error {
  margin: 10px 0 0;
  padding: 8px 12px;
  border: 1px solid #1f1f1f;
  border-radius: 8px;
  background: #e8e8e8;
  color: #303030;
  font-size: 12px;
}
.settings-error[hidden] { display: none; }

/* Narrow screens: the name takes its own line, the id and count share the next
   one, and the actions sit on a full-width row. Nothing overlaps or overflows. */
@media (width < 40rem) {
  .settings-row { flex-wrap: wrap; }
  .settings-row__name,
  .settings-row__input { flex: 1 1 100%; }
  .settings-row__id {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .settings-row__count { flex: 0 0 auto; }
  .settings-row__actions { flex: 1 1 100%; justify-content: flex-end; }
}
`;
