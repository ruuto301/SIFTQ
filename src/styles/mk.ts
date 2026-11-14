export const MK_CSS = `
.page--mk {
  background: transparent;
  color: #1b1f24;
  min-height: calc(100vh - 63px);
  padding: 24px 16px 48px;
}

.mk-layout {
  display: grid;
  gap: 24px;
  grid-template-columns: minmax(0, 1fr);
}

@media (width >= 60rem) {
  .mk-layout {
    grid-template-columns: 220px minmax(0, 1fr);
  }
}

.mk-sidebar {
  align-self: start;
  display: grid;
  gap: 16px;
}

.mk-filters {
  display: grid;
  gap: 4px;
}

.mk-filter {
  align-items: center;
  border-radius: 999px;
  color: #1b1f24;
  display: flex;
  gap: 8px;
  justify-content: space-between;
  padding: 8px 12px;
  text-decoration: none;
}

.mk-filter:hover,
.mk-filter:focus-visible {
  background: #f3f6fa;
}

.mk-filter.is-active {
  background: #1b1f24;
  color: #fff;
}

.mk-filter__count {
  font-size: 12px;
  opacity: 0.7;
}

.mk-color-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.mk-color-filter {
  border: 1px solid #d8dde3;
  border-radius: 999px;
  display: inline-flex;
  padding: 3px;
}

.mk-color-filter.is-active {
  border-color: #1b1f24;
}

.mk-color-filter__dot {
  border: 1px solid #d8dde3;
  border-radius: 50%;
  display: block;
  height: 18px;
  width: 18px;
}

.mk-color-filter__dot--all {
  background: linear-gradient(135deg, #ffe9e7, #ffeddc, #fff5cf, #e4f3df, #e1efff, #efe7fb);
}

.mk-color-filter__dot--default {
  background: #ffffff;
}

.mk-color-filter__dot--red {
  background: #ffe9e7;
}

.mk-color-filter__dot--orange {
  background: #ffeddc;
}

.mk-color-filter__dot--yellow {
  background: #fff5cf;
}

.mk-color-filter__dot--green {
  background: #e4f3df;
}

.mk-color-filter__dot--blue {
  background: #e1efff;
}

.mk-color-filter__dot--purple {
  background: #efe7fb;
}

.mk-main {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.mk-toolbar {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.mk-search {
  align-items: center;
  display: flex;
  gap: 8px;
}

.mk-search input[type="search"] {
  background: #fff;
  border: 1px solid #d8dde3;
  border-radius: 999px;
  color: #1b1f24;
  font: inherit;
  min-width: 200px;
  padding: 6px 14px;
}

.mk-composer {
  background: #fff;
  border: 1px solid #d8dde3;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgb(31 35 40 / 8%);
}

.mk-composer__trigger {
  background: transparent;
  border: 0;
  color: #3f4854;
  cursor: text;
  display: block;
  font: inherit;
  font-size: 14px;
  min-height: 48px;
  padding: 0 16px;
  text-align: left;
  width: 100%;
}

.mk-composer--open .mk-composer__trigger {
  display: none;
}

.mk-composer__editor {
  display: grid;
  gap: 12px;
  padding: 16px;
}

.mk-composer__editor[hidden] {
  display: none;
}

.mk-composer__title,
.mk-composer__body {
  background: transparent;
  border: 0;
  color: #1b1f24;
  font: inherit;
  outline: 0;
  padding: 0;
  width: 100%;
}

.mk-composer__title {
  font-size: 17px;
  font-weight: 700;
}

.mk-composer__body {
  line-height: 1.55;
  min-height: 72px;
  resize: vertical;
}

.mk-composer__colors,
.mk-bulk-bar__colors {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.mk-composer__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.mk-swatch {
  border: 1px solid #d8dde3;
  border-radius: 50%;
  cursor: pointer;
  height: 24px;
  padding: 0;
  width: 24px;
}

.mk-swatch[aria-pressed="true"] {
  border-color: #1b1f24;
  outline: 2px solid #1b1f24;
  outline-offset: 1px;
}

.mk-swatch--default {
  background: #ffffff;
}

.mk-swatch--red {
  background: #ffe9e7;
}

.mk-swatch--orange {
  background: #ffeddc;
}

.mk-swatch--yellow {
  background: #fff5cf;
}

.mk-swatch--green {
  background: #e4f3df;
}

.mk-swatch--blue {
  background: #e1efff;
}

.mk-swatch--purple {
  background: #efe7fb;
}

.mk-bulk-bar {
  align-items: center;
  background: #f3f6fa;
  border: 1px solid #d8dde3;
  border-radius: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 8px 12px;
}

.mk-bulk-bar[hidden] {
  display: none;
}

.mk-bulk-bar__count {
  font-size: 13px;
}

.mk-grid {
  column-gap: 16px;
  columns: 1;
}

@media (width >= 48rem) {
  .mk-grid {
    columns: 2;
  }
}

@media (width >= 72rem) {
  .mk-grid {
    columns: 3;
  }
}

@media (width >= 100rem) {
  .mk-grid {
    columns: 4;
  }
}

.mk-card {
  border: 1px solid #d8dde3;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgb(31 35 40 / 8%);
  break-inside: avoid;
  margin: 0 0 16px;
  padding: 12px 14px;
  position: relative;
}

.mk-card.is-selected {
  border-color: #1b1f24;
}

.mk-card__select-label {
  left: 10px;
  position: absolute;
  top: 10px;
}

.mk-card__select {
  display: none;
}

.page--mk[data-mk-selecting="true"] .mk-card__select {
  display: block;
}

.page--mk[data-mk-selecting="true"] .mk-card__title,
.page--mk[data-mk-selecting="true"] .mk-card__body {
  padding-left: 24px;
}

.mk-card__actions {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
}

.mk-card__pin,
.mk-card__delete {
  background: transparent;
  border: 0;
  border-radius: 4px;
  color: #3f4854;
  cursor: pointer;
  font: inherit;
  padding: 2px 6px;
}

.mk-card__pin:hover,
.mk-card__delete:hover,
.mk-card__pin:focus-visible,
.mk-card__delete:focus-visible {
  background: rgb(255 255 255 / 60%);
  color: #1b1f24;
}

.mk-card__pin svg {
  fill: none;
  height: 16px;
  stroke: currentColor;
  stroke-width: 1.5;
  width: 16px;
}

.mk-card[data-mk-pinned="true"] .mk-card__pin svg {
  fill: currentColor;
}

.mk-card__title {
  font-size: 16px;
  line-height: 1.4;
  margin: 8px 0 0;
  overflow-wrap: anywhere;
}

.mk-card__body {
  color: #3f4854;
  font-size: 14px;
  line-height: 1.55;
  margin: 8px 0 0;
  max-height: 336px;
  overflow: hidden;
  white-space: pre-wrap;
}

.mk-card--default {
  background: #ffffff;
}

.mk-card--red {
  background: #ffe9e7;
}

.mk-card--orange {
  background: #ffeddc;
}

.mk-card--yellow {
  background: #fff5cf;
}

.mk-card--green {
  background: #e4f3df;
}

.mk-card--blue {
  background: #e1efff;
}

.mk-card--purple {
  background: #efe7fb;
}

.mk-empty {
  color: #3f4854;
}
`;
