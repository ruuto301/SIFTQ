export const BASE_CSS = `
:root {
  color: #303030;
  background: #cccccc;
  font-family: "Atkinson Hyperlegible", "Noto Sans JP", Inter, ui-sans-serif, system-ui,
    -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

/* 編集中の画像も本文幅を上限にし、縦長は 320px で全体を見せる。 */
.description-image {
  border: 1px solid #d8dde3;
  border-radius: 8px;
  display: block;
  height: auto;
  margin: 6px 0;
  max-height: 320px;
  max-width: 100%;
  object-fit: contain;
  width: auto;
}

body {
  background: #cccccc;
  color: #303030;
  font-size: 14.5px;
  letter-spacing: 0.005em;
  line-height: 1.7;
  margin: 0;
}

/* Compact rows keep their density; the taller reading rhythm is for prose. */
.task-row,
.ds__task-item,
.ds__group-head,
.ds__task,
.task-bulk-menu-items button,
.task-label-menu a,
.nav a,
.button,
.label,
.status,
.task-list-toolbar {
  line-height: 1.4;
}

html:has(dialog[open]) {
  overflow: hidden;
}

::selection {
  background: #d9d9d9;
  color: #1f1f1f;
}

:focus-visible {
  outline: 2px solid #1f1f1f;
  outline-offset: 2px;
}

.description-editor,
.ideas-composer__description,
.idea-detail-modal .idea-detail__form,
.idea-detail__description {
  scrollbar-color: #8a8a8a transparent;
  scrollbar-width: thin;
}

.description-editor::-webkit-scrollbar,
.ideas-composer__description::-webkit-scrollbar,
.idea-detail-modal .idea-detail__form::-webkit-scrollbar,
.idea-detail__description::-webkit-scrollbar {
  height: 8px;
  width: 8px;
}

.description-editor::-webkit-scrollbar-track,
.ideas-composer__description::-webkit-scrollbar-track,
.idea-detail-modal .idea-detail__form::-webkit-scrollbar-track,
.idea-detail__description::-webkit-scrollbar-track {
  background: transparent;
}

.description-editor::-webkit-scrollbar-button,
.ideas-composer__description::-webkit-scrollbar-button,
.idea-detail-modal .idea-detail__form::-webkit-scrollbar-button,
.idea-detail__description::-webkit-scrollbar-button {
  display: none;
}

.description-editor::-webkit-scrollbar-thumb,
.ideas-composer__description::-webkit-scrollbar-thumb,
.idea-detail-modal .idea-detail__form::-webkit-scrollbar-thumb,
.idea-detail__description::-webkit-scrollbar-thumb {
  background: transparent;
  background-clip: content-box;
  border: 2px solid transparent;
  border-radius: 999px;
}

.description-editor:hover::-webkit-scrollbar-thumb,
.ideas-composer__description:hover::-webkit-scrollbar-thumb,
.idea-detail-modal .idea-detail__form:hover::-webkit-scrollbar-thumb,
.idea-detail__description:hover::-webkit-scrollbar-thumb,
.description-editor:focus-within::-webkit-scrollbar-thumb,
.ideas-composer__description:focus-within::-webkit-scrollbar-thumb,
.idea-detail-modal .idea-detail__form:focus-within::-webkit-scrollbar-thumb,
.idea-detail__description:focus-within::-webkit-scrollbar-thumb {
  background: #8a8a8a;
}

a {
  color: inherit;
  text-decoration: none;
}

.shell {
  min-height: 100vh;
}

.topbar {
  align-items: center;
  background: #cccccc;
  border: 1px solid #bdbdbd;
  display: flex;
  gap: 16px;
  justify-content: flex-start;
  padding: 14px 20px;
  flex-wrap: wrap;
}

.brand {
  font-size: 18px;
  font-weight: 700;
}

.move-error {
  background: #e8e8e8;
  border: 1px solid #1f1f1f;
  color: #303030;
  font-weight: 600;
  margin: 0;
  padding: 12px 20px;
}

.nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.topbar-actions {
  align-items: center;
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.logout {
  margin: 0;
}

.nav a,
.button {
  background: #e4e4e4;
  border: 2px solid #1f1f1f;
  border-radius: 999px;
  color: #303030;
  display: inline-flex;
  font-size: 14px;
  font-weight: 600;
  min-height: 34px;
  padding: 7px 12px;
}

.nav .active,
.button.primary {
  background: #262626;
  border-color: #dcdcdc;
  color: #dcdcdc;
}

.page {
  margin: 0 auto;
  max-width: 1180px;
  padding: 24px;
}

.task-status-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 18px;
}

.task-status-filter .button.small {
  min-height: 32px;
  padding: 5px 12px;
}

.task-status-filter .button.is-active {
  background: #262626;
  border-color: #dcdcdc;
  color: #dcdcdc;
}

.task-status-filter--toolbar {
  margin-bottom: 0;
}

.task-status-filter[hidden],
.task-selection-summary[hidden] {
  display: none;
}

.task-selection-summary {
  align-items: center;
  color: #303030;
  display: flex;
  font-size: 14px;
  font-weight: 600;
  min-height: 32px;
  margin: 0 0 18px;
}

.task-selection-summary--toolbar {
  margin: 0;
}

.page-header {
  align-items: center;
  display: flex;
  gap: 16px;
  justify-content: space-between;
  margin-bottom: 18px;
}

.page-title {
  color: #303030;
  font-size: 24px;
  margin: 0;
}

.muted {
  color: #555555;
  font-size: 13px;
}

.label {
  border: 1px solid transparent;
  border-radius: 999px;
  display: inline-flex;
  font-size: 12px;
  font-weight: 700;
  padding: 3px 8px;
  width: max-content;
}

.label--project {
  background: #e4e4e4;
  border-color: #1f1f1f;
  color: #303030;
}

.label--project-none {
  background: #e4e4e4;
  border-color: #bdbdbd;
  color: #555555;
}

.task-card,
.task-row {
  background: #d8d8d8;
  border: 2px solid #1f1f1f;
  border-radius: 8px;
}

.form-panel,
.side-panel,
.state-card {
  background: #d8d8d8;
  border: 2px solid #1f1f1f;
  border-radius: 8px;
}

.task-card {
  box-shadow: 0 1px 2px rgb(0 0 0 / 12%);
  display: flex;
  flex-direction: column;
  margin-bottom: 12px;
  min-height: 72px;
  padding: 12px;
}

.task-card--working,
.task-row--working {
  border-left: 4px solid #6b6b6b;
}

.task-card:hover {
  border-color: #1f1f1f;
  box-shadow: 0 0 0 2px #bdbdbd;
}

.task-card-header {
  align-items: flex-start;
  display: flex;
  gap: 8px;
  justify-content: space-between;
}

.task-title {
  font-weight: 700;
}

.status {
  border: 1px solid transparent;
  border-radius: 999px;
  display: inline-flex;
  font-size: 12px;
  font-weight: 700;
  padding: 3px 8px;
  width: max-content;
}

.status--do {
  background: transparent;
  border-color: #1f1f1f;
  color: #303030;
}

.status--done {
  background: #262626;
  border: 2px solid #dcdcdc;
  color: #dcdcdc;
}

.status--skip {
  background: transparent;
  border-color: #6b6b6b;
  color: #3f3f3f;
}

.working-badge {
  align-items: center;
  background: transparent;
  border: 1px solid #6b6b6b;
  border-radius: 999px;
  color: #6b6b6b;
  display: inline-flex;
  font-size: 12px;
  font-weight: 700;
  gap: 5px;
  padding: 3px 8px;
  width: max-content;
}

.working-badge::before {
  background: #6b6b6b;
  border-radius: 50%;
  content: "";
  height: 6px;
  width: 6px;
}

.project-select {
  margin-bottom: 0;
}

.project-select--none {
  color: #555555;
}

.matrix-menu {
  background: #d8d8d8;
  border: 2px solid #1f1f1f;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgb(0 0 0 / 18%);
  display: grid;
  min-width: 220px;
  padding: 6px;
  position: fixed;
  z-index: 50;
}

.matrix-menu-item {
  background: none;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  padding: 8px 10px;
  text-align: left;
}

.matrix-menu-item:hover {
  background: #e4e4e4;
}

.matrix-menu-item--delete {
  color: #303030;
}

.matrix-modal-backdrop {
  align-items: center;
  background: rgb(0 0 0 / 45%);
  display: flex;
  inset: 0;
  justify-content: center;
  padding: 24px;
  position: fixed;
  z-index: 100;
}

.matrix-modal {
  background: #d8d8d8;
  border: 2px solid #1f1f1f;
  border-radius: 12px;
  box-shadow: 0 16px 36px rgb(0 0 0 / 30%);
  display: flex;
  flex-direction: column;
  height: 160px;
  justify-content: space-between;
  max-width: 90vw;
  padding: 16px 20px;
  width: 320px;
}

.matrix-modal-text {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
}

.matrix-modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.matrix-modal-button {
  border: 2px solid #1f1f1f;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  min-height: 34px;
  padding: 7px 16px;
}

.matrix-modal-button--cancel {
  background: #e4e4e4;
}

.matrix-modal-button--cancel:hover {
  background: #d8d8d8;
}

.matrix-modal-button--danger {
  background: #262626;
  border-color: #dcdcdc;
  color: #dcdcdc;
}

.matrix-modal-button--danger:hover {
  background: #303030;
}

@media (width < 40rem) {
  .topbar {
    padding: 12px 16px;
  }

  .nav {
    flex-basis: 100%;
    order: 3;
  }

  .nav a {
    flex: 1;
    justify-content: center;
  }

  .page {
    padding: 16px;
  }

  .page-header {
    align-items: flex-start;
    flex-wrap: wrap;
  }
}

@media (width >= 40rem) {
  .topbar {
    flex-wrap: nowrap;
  }
}
`;
