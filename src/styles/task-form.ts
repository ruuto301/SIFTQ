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

.description-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
  min-height: 180px;
}

.description-tabs {
  display: inline-flex;
  gap: 4px;
}

.description-tab {
  background: transparent;
  border: 1px solid #bdbdbd;
  border-radius: 999px;
  color: #555555;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  padding: 4px 12px;
}

.description-tab[aria-selected="true"] {
  background: #262626;
  border-color: #262626;
  color: #dcdcdc;
}

.description-tabs__panel {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.description-tabs__panel[hidden] {
  display: none;
}

.description-field label {
  margin-bottom: 0;
}

.description-preview {
  background: #e4e4e4;
  border: 2px solid #1f1f1f;
  border-radius: 6px;
  color: #303030;
  display: block;
  min-height: 180px;
  overflow: auto;
  padding: 9px 10px;
}

.description-preview > :first-child {
  margin-top: 0;
}

.description-preview > :last-child {
  margin-bottom: 0;
}

.description-preview a {
  color: inherit;
  text-decoration: underline;
}

.description-preview blockquote {
  border-left: 3px solid #bdbdbd;
  color: #555555;
  margin: 8px 0;
  padding-left: 10px;
}

.description-preview code {
  background: #d8d8d8;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  padding: 1px 4px;
}

.description-preview h1,
.description-preview h2,
.description-preview h3,
.description-preview h4,
.description-preview h5,
.description-preview h6 {
  font-size: 15px;
  margin: 12px 0 6px;
}

/* 本文幅を上限にした原寸（拡大しない）。縦長は 320px で全体を見せる。 */
.description-preview img {
  background: #f6f8fa;
  border: 1px solid #d8dde3;
  border-radius: 8px;
  cursor: zoom-in;
  display: block;
  height: auto;
  margin: 6px 0;
  max-height: 320px;
  max-width: 100%;
  object-fit: contain;
  width: auto;
}

.description-preview img:hover {
  filter: brightness(0.96);
}

.description-preview img:focus-visible {
  outline: 2px solid #1f1f1f;
  outline-offset: 2px;
}

.description-lightbox {
  align-items: center;
  display: flex;
  inset: 0;
  justify-content: center;
  position: fixed;
  z-index: 200;
}

.description-lightbox[hidden] {
  display: none;
}

.description-lightbox__backdrop {
  background: rgb(20 20 22 / 78%);
  border: 0;
  cursor: zoom-out;
  inset: 0;
  position: absolute;
}

.description-lightbox__frame {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  max-height: 92vh;
  max-width: 92vw;
  position: relative;
}

.description-lightbox__image {
  background: #ffffff;
  border-radius: 8px;
  max-height: 84vh;
  max-width: 92vw;
  object-fit: contain;
}

.description-lightbox__bar {
  align-items: center;
  color: #ffffff;
  display: flex;
  font-size: 12px;
  gap: 12px;
  justify-content: flex-end;
}

.description-preview li {
  margin: 2px 0;
}

.description-preview ol,
.description-preview ul {
  margin: 6px 0;
  padding-left: 22px;
}

.description-preview p {
  margin: 6px 0;
  white-space: pre-wrap;
}

.description-preview pre {
  background: #d8d8d8;
  border-radius: 6px;
  overflow: auto;
  padding: 10px;
}

.description-preview pre code {
  background: transparent;
  font-size: 12px;
  padding: 0;
}

.description-preview table {
  border-collapse: collapse;
  margin: 6px 0;
}

.description-preview td,
.description-preview th {
  border: 1px solid #bdbdbd;
  padding: 4px 8px;
  text-align: left;
}

.description-preview .task-list-item {
  list-style: none;
  margin-left: -18px;
}

.description-preview input[type="checkbox"] {
  margin-right: 6px;
}

/* The task form mirrors the contenteditable into a hidden textarea; the DS
   field uses the same attribute on its visible editor. */
.description-field textarea[data-description-value] {
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

.page--new .description-field,
.page--detail .description-field {
  flex: 1;
  min-height: 180px;
}

.page--new .description-field label,
.page--detail .description-field label {
  flex: 1;
  grid-template-rows: auto minmax(0, 1fr);
  min-height: 180px;
}

.page--new textarea,
.page--detail textarea,
.page--new .description-editor,
.page--detail .description-editor,
.page--new .description-preview,
.page--detail .description-preview {
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
