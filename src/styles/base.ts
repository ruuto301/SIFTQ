export const BASE_CSS = `
:root {
  color: #1b1f24;
  background: #3b434d;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
    "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

.description-image {
  display: block;
  height: auto;
  max-width: 100%;
  border-radius: 4px;
}

body {
  margin: 0;
}

html:has(dialog[open]) {
  overflow: hidden;
}

::selection {
  background: #444444;
  color: #ffffff;
}

:focus-visible {
  box-shadow: 0 0 0 4px #e6e9ee;
  outline: 2px solid #0f4d24;
  outline-offset: 2px;
}

.description-editor,
.ideas-composer__description,
.idea-detail-modal .idea-detail__form,
.idea-detail__description {
  scrollbar-color: #8b949e transparent;
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
  background: #8b949e;
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
  background: #e6e9ee;
  border-bottom: 1px solid #8b949e;
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
  background: #f8d7da;
  border-bottom: 1px solid #d73a49;
  color: #7a1c24;
  font-weight: 600;
  margin: 0;
  padding: 12px 20px;
}

.nav {
  display: flex;
  gap: 8px;
}

.logout {
  margin: 0 0 0 auto;
}

.nav a,
.button {
  background: #c1c9d3;
  border: 1px solid #8b949e;
  border-radius: 6px;
  display: inline-flex;
  font-size: 14px;
  font-weight: 600;
  min-height: 34px;
  padding: 7px 12px;
}

.nav .active,
.button.primary {
  background: #1f883d;
  border-color: #2a9147;
  color: #ffffff;
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
  background: #1f883d;
  border-color: #2a9147;
  color: #ffffff;
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
  color: #1b1f24;
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
  color: #e6e9ee;
  font-size: 24px;
  margin: 0;
}

.muted {
  color: #b1bac4;
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
  background: #eef4ff;
  border-color: #c7d3e3;
  color: #1b1f24;
}

.label--project-none {
  background: #f6f8fa;
  border-color: #8b949e;
  color: #3f4854;
}

.task-card,
.task-row {
  background: #c1c9d3;
  border: 1px solid #8b949e;
  border-radius: 8px;
}

.form-panel,
.side-panel,
.state-card {
  background: #c1c9d3;
  border: 1px solid #8b949e;
  border-radius: 8px;
}

.task-card {
  border-color: #1b1f24;
  box-shadow: 0 1px 2px rgb(31 35 40 / 12%);
  display: flex;
  flex-direction: column;
  margin-bottom: 12px;
  min-height: 72px;
  padding: 12px;
}

.task-card--working,
.task-row--working {
  border-left: 4px solid #0f4d24;
}

.task-card:hover {
  border-color: #1f883d;
  box-shadow: 0 0 0 2px #b7e3c3;
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
  border-color: #1b1f24;
  color: #1b1f24;
}

.status--done {
  background: #b7e3c3;
  border-color: #4ac26b;
  color: #0f4d24;
}

.status--skip {
  background: #f6f8fa;
  border-color: #8b949e;
  color: #3f4854;
}

.working-badge {
  align-items: center;
  background: transparent;
  border: 1px solid #0f4d24;
  border-radius: 999px;
  color: #0f4d24;
  display: inline-flex;
  font-size: 12px;
  font-weight: 700;
  gap: 5px;
  padding: 3px 8px;
  width: max-content;
}

.working-badge::before {
  background: #0f4d24;
  border-radius: 50%;
  content: "";
  height: 6px;
  width: 6px;
}

.project-select {
  margin-bottom: 0;
}

.project-select--none {
  color: #3f4854;
}

.matrix-menu {
  background: #c1c9d3;
  border: 1px solid #8b949e;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgb(31 35 40 / 18%);
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
  background: #eaeef2;
}

.matrix-menu-item--delete {
  color: #1b1f24;
}

.matrix-modal-backdrop {
  align-items: center;
  background: rgb(31 35 40 / 45%);
  display: flex;
  inset: 0;
  justify-content: center;
  padding: 24px;
  position: fixed;
  z-index: 100;
}

.matrix-modal {
  background: #c1c9d3;
  border: 1px solid #8b949e;
  border-radius: 12px;
  box-shadow: 0 16px 36px rgb(31 35 40 / 30%);
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
  border: 1px solid #8b949e;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  min-height: 34px;
  padding: 7px 16px;
}

.matrix-modal-button--cancel {
  background: #c1c9d3;
}

.matrix-modal-button--cancel:hover {
  background: #eaeef2;
}

.matrix-modal-button--danger {
  background: #1b1f24;
  border-color: #1b1f24;
  color: #ffffff;
}

.matrix-modal-button--danger:hover {
  background: #1b1f24;
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
