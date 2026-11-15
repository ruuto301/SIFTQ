export const TASK_FORM_CSS = `
.detail-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(0, 1fr);
}

.form-panel,
.side-panel,
.state-card {
  padding: 16px;
}

.side-panel--popover-open {
  position: relative;
}

.meta-row {
  align-items: center;
  display: flex;
  justify-content: space-between;
}

.meta-row-link {
  border-radius: 6px;
  margin: -6px -6px 0;
  padding: 6px;
}

.meta-row-link:hover {
  background: #e4e4e4;
  cursor: pointer;
}

.meta-row-link::marker {
  content: "";
}

.meta-row-link::-webkit-details-marker {
  display: none;
}

.meta-row h2 {
  font-size: 16px;
  margin: 0;
}

.meta-row--spaced {
  border-top: 1px solid #bdbdbd;
  margin-top: 16px;
  margin-bottom: 8px;
  padding-top: 16px;
}

/* Right side panel: keep the same gap between every heading row and its control. */
.side-panel > .meta-row-link {
  margin-bottom: 8px;
}

.meta-caret {
  align-items: center;
  border: 0;
  color: #555555;
  display: inline-flex;
  font-size: 20px;
  justify-content: center;
  min-height: 32px;
  min-width: 32px;
}

label {
  display: grid;
  font-size: 13px;
  font-weight: 700;
  gap: 6px;
  margin-bottom: 14px;
}

input,
textarea,
select,
.description-editor {
  background: #e4e4e4;
  border: 2px solid #1f1f1f;
  border-radius: 6px;
  color: #303030;
  font: inherit;
  padding: 9px 10px;
  width: 100%;
}

textarea {
  min-height: 180px;
}

.description-editor {
  background: #e4e4e4;
  min-height: 180px;
  overflow: auto;
  white-space: pre-wrap;
}

.description-editor a {
  color: inherit;
  text-decoration: underline;
}

textarea[data-description-value] {
  display: none;
}

.page--new,
.page--detail {
  display: flex;
  flex-direction: column;
  height: auto;
  min-height: calc(100vh - 63px);
}

.page--new .detail-grid,
.page--detail .detail-grid {
  flex: 1;
  min-height: 0;
}

.page--new .form-panel,
.page--detail .form-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.page--new .form-panel > label:has([data-description-editor]),
.page--detail .form-panel > label:has([data-description-editor]) {
  flex: 1;
  grid-template-rows: auto minmax(0, 1fr);
  min-height: 180px;
}

.page--new textarea,
.page--detail textarea,
.page--new .description-editor,
.page--detail .description-editor {
  height: 100%;
  min-height: 180px;
}

.form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.form-actions .button {
  flex: 1 1 140px;
  justify-content: center;
}

.status-menu {
  display: grid;
  gap: 8px;
  margin-top: 12px;
}

.status-option {
  border: 1px solid #1f1f1f;
  border-radius: 6px;
  padding: 10px;
}

.popover {
  background: #d8d8d8;
  border: 2px solid #1f1f1f;
  border-radius: 12px;
  box-shadow: 0 16px 36px rgb(0 0 0 / 18%);
  display: grid;
  gap: 0;
  margin-top: 10px;
  min-width: 0;
  width: min(360px, calc(100vw - 32px));
  padding: 0;
  position: absolute;
  right: 0;
  top: 78px;
  z-index: 2;
}

details:not([open]) .popover {
  display: none;
}

.popover h3 {
  font-size: 16px;
  margin: 0;
  padding: 16px 16px 8px;
}

.status-group-title {
  background: #e1e1e1;
  border-bottom: 1px solid #bdbdbd;
  border-top: 1px solid #bdbdbd;
  color: #555555;
  font-size: 13px;
  font-weight: 700;
  padding: 10px 16px;
}

.status-choice {
  align-items: start;
  background: #e8e8e8;
  border: 1px solid #1f1f1f;
  display: grid;
  gap: 10px;
  grid-template-columns: 20px 16px 1fr;
  padding: 12px 16px;
}

.status-choice.selected {
  background: #dcdcdc;
  box-shadow: inset 4px 0 0 #1f1f1f;
}

button.status-choice {
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
  width: 100%;
}

.check {
  align-items: center;
  background: #262626;
  border: 2px solid #dcdcdc;
  border-radius: 4px;
  color: #dcdcdc;
  display: inline-flex;
  font-weight: 700;
  height: 20px;
  justify-content: center;
  width: 20px;
}

.box {
  border: 1px solid #1f1f1f;
  border-radius: 4px;
  display: inline-flex;
  height: 20px;
  width: 20px;
}

.status-dot {
  border-radius: 999px;
  display: inline-flex;
  height: 16px;
  margin-top: 2px;
  width: 16px;
}

.status-dot--do {
  background: #1f1f1f;
}

.status-dot--done {
  background: #262626;
}

.status-dot--skip {
  background: #8a8a8a;
}

@media (width >= 48rem) {
  .detail-grid {
    grid-template-columns: minmax(0, 1fr) 250px;
  }

  .page--new,
  .page--detail {
    height: calc(100vh - 63px);
    min-height: 480px;
  }

  .form-actions .button {
    flex: 0 0 auto;
  }
}
`;
