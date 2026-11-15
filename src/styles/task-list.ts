export const TASK_LIST_CSS = `
.list {
  background: #d8d8d8;
  border: 2px solid #1f1f1f;
  border-radius: 8px;
  overflow: hidden;
}

.task-list-empty {
  color: #555555;
  margin: 0;
  padding: 24px;
  text-align: center;
}

.task-row {
  align-items: center;
  border: 0;
  border-radius: 0;
  display: grid;
  gap: 10px;
  grid-template-columns: 28px minmax(0, 1fr);
  min-height: 68px;
  padding: 12px 14px;
}

/* The list owns the frame; rows are separated by a hairline instead of their own border. */
.task-row + .task-row {
  border-top: 1px solid #bdbdbd;
}

.task-row:hover,
.task-row-link:hover {
  background: #e4e4e4;
}

.task-row.is-selected {
  background: #dcdcdc;
  box-shadow: inset 3px 0 0 #1f1f1f;
}

.task-row-selection {
  align-items: center;
  display: flex;
  justify-content: center;
  margin: 0;
}

.task-row-selection input,
.task-select-all input {
  accent-color: #1f1f1f;
  height: 20px;
  margin: 0;
  width: 20px;
}

.task-row-link {
  align-items: center;
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(0, 1fr);
  min-width: 0;
}

.task-row-link:focus-visible,
.task-row-selection:has(input:focus-visible) {
  outline: 2px solid #1f1f1f;
  outline-offset: 2px;
}

.task-row-main {
  display: grid;
  gap: 4px;
}

.task-row-title {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  column-gap: 10px;
  row-gap: 6px;
}

.task-row:last-child {
  border-bottom: 0;
}

.task-list-shell {
  min-width: 0;
}

.task-list-toolbar {
  align-items: center;
  background: #d8d8d8;
  border: 2px solid #1f1f1f;
  border-radius: 8px;
  display: flex;
  gap: 12px;
  margin-bottom: 10px;
  min-height: 48px;
  padding: 8px 12px;
}

.task-select-all {
  align-items: center;
  display: flex;
  gap: 8px;
  margin: 0;
  white-space: nowrap;
}

.task-select-all input {
  flex: 0 0 auto;
}

.task-selection-count {
  white-space: nowrap;
}

.task-bulk-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-left: auto;
}

.task-bulk-actions [data-task-bulk-actions] {
  display: flex;
}

.task-bulk-actions [data-task-bulk-actions] {
  align-items: center;
  gap: 6px;
}

.task-bulk-actions button:disabled {
  color: #8a8a8a;
  cursor: default;
  opacity: 0.7;
}

.task-label-filter {
  position: relative;
}

.task-label-filter summary {
  cursor: pointer;
  list-style: none;
}

.task-label-filter summary::-webkit-details-marker {
  display: none;
}

.task-label-filter summary::after {
  content: "▾";
  margin-left: 6px;
}

.task-label-filter.is-active summary {
  background: #262626;
  border-color: #dcdcdc;
  color: #dcdcdc;
}

.task-label-menu {
  background: #e1e1e1;
  border: 2px solid #1f1f1f;
  border-radius: 6px;
  box-shadow: 0 8px 24px rgb(0 0 0 / 18%);
  display: grid;
  gap: 2px;
  min-width: 140px;
  padding: 4px;
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 3;
}

.task-label-menu a {
  background: #e8e8e8;
  border: 1px solid #1f1f1f;
  border-radius: 4px;
  color: #303030;
  margin: 2px;
  padding: 7px 8px;
}

.task-label-menu a:hover,
.task-label-menu a.is-selected {
  background: #d8d8d8;
}

.task-bulk-menu {
  position: relative;
}

.task-bulk-menu summary {
  cursor: pointer;
  list-style: none;
}

.task-bulk-menu summary::-webkit-details-marker {
  display: none;
}

.task-bulk-menu summary::after {
  content: "▾";
  margin-left: 6px;
}

.task-bulk-menu-items {
  background: #e1e1e1;
  border: 2px solid #1f1f1f;
  border-radius: 6px;
  box-shadow: 0 8px 24px rgb(0 0 0 / 18%);
  display: grid;
  gap: 2px;
  min-width: 120px;
  padding: 4px;
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 3;
}

.task-bulk-menu-items button {
  background: #e8e8e8;
  border: 1px solid #1f1f1f;
  border-radius: 4px;
  color: #303030;
  cursor: pointer;
  margin: 2px;
  padding: 7px 8px;
  text-align: left;
}

.task-bulk-menu-items button:hover {
  background: #d8d8d8;
}

.task-bulk-actions[hidden],
.task-selection-feedback[hidden] {
  display: none;
}

.task-selection-feedback {
  background: #e8e8e8;
  border: 1px solid #1f1f1f;
  border-radius: 6px;
  color: #303030;
  margin: 0 0 10px;
  padding: 8px 12px;
}

.task-search {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.task-search input {
  flex: 1;
  min-width: 0;
}

.task-search-button {
  align-items: center;
  justify-content: center;
  min-width: 36px;
  padding: 7px;
}

.task-search-button svg {
  fill: none;
  height: 16px;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
  width: 16px;
}

.button--danger {
  color: #303030;
}

.pagination {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  margin-top: 18px;
}

.pagination .button.small.is-active {
  background: #262626;
  border-color: #dcdcdc;
  color: #dcdcdc;
}

.pagination .button.small.is-disabled {
  color: #8a8a8a;
  cursor: default;
}

.pagination-ellipsis {
  color: #555555;
  font-weight: 700;
  padding: 0 4px;
}

`;

export const TASK_LIST_RESPONSIVE_CSS = `
@media (width < 40rem) {
  .task-list-toolbar {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .task-status-filter--toolbar {
    flex: 1;
    margin-bottom: 0;
  }

  .task-bulk-actions {
    margin-left: 0;
    width: 100%;
  }

  .task-bulk-actions .button {
    flex: 1;
  }

  .task-bulk-actions [data-task-bulk-actions] {
    flex: 1;
  }

  .task-bulk-menu {
    flex: 1;
  }

  .task-bulk-menu summary {
    justify-content: center;
    width: 100%;
  }
}
`;
