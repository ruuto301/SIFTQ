export const MK_CSS = `
.page--mk {
  background: transparent;
  color: #303030;
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
  color: #303030;
  display: flex;
  gap: 8px;
  justify-content: space-between;
  padding: 8px 12px;
  text-decoration: none;
}

.mk-filter:hover,
.mk-filter:focus-visible {
  background: #e4e4e4;
}

.mk-filter.is-active {
  background: #262626;
  border: 2px solid #dcdcdc;
  color: #dcdcdc;
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
  border: 2px solid #1f1f1f;
  border-radius: 999px;
  display: inline-flex;
  padding: 3px;
}

.mk-color-filter.is-active {
  background: #262626;
  border-color: #dcdcdc;
}

.mk-color-filter__dot {
  border: 1px solid #1f1f1f;
  border-radius: 50%;
  display: block;
  height: 18px;
  width: 18px;
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
  background: #e4e4e4;
  border: 2px solid #1f1f1f;
  border-radius: 999px;
  color: #303030;
  font: inherit;
  min-width: 200px;
  padding: 6px 14px;
}

.mk-composer {
  background: #d8d8d8;
  border: 2px solid #1f1f1f;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 8%);
}

.mk-composer__trigger {
  background: transparent;
  border: 0;
  color: #555555;
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
  color: #303030;
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

.mk-composer__images[hidden],
.mk-composer__error[hidden] {
  display: none;
}

.mk-composer__image-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.mk-composer__image {
  position: relative;
}

.mk-composer__image-thumb {
  border: 1px solid #bdbdbd;
  border-radius: 6px;
  display: block;
  height: 72px;
  object-fit: cover;
  width: 72px;
}

.mk-composer__image-remove {
  background: #262626;
  border: 2px solid #dcdcdc;
  border-radius: 50%;
  color: #dcdcdc;
  cursor: pointer;
  font: inherit;
  height: 20px;
  line-height: 1;
  padding: 0;
  position: absolute;
  right: -6px;
  top: -6px;
  width: 20px;
}

.mk-composer__error {
  color: #1f1f1f;
  font-size: 13px;
  margin: 0;
}

.mk-composer__attachments {
  align-items: center;
  display: flex;
  gap: 8px;
  justify-content: flex-start;
}

.mk-composer__hint {
  color: #555555;
  font-size: 11px;
}

.mk-composer__file {
  height: 1px;
  opacity: 0;
  overflow: hidden;
  position: absolute;
  width: 1px;
}

.mk-card__image-wrap {
  margin-top: 8px;
  position: relative;
}

.mk-card__image {
  border-radius: 6px;
  display: block;
  height: 120px;
  object-fit: cover;
  width: 100%;
}

.mk-card__image-remove {
  background: #262626;
  border: 2px solid #dcdcdc;
  border-radius: 50%;
  color: #dcdcdc;
  cursor: pointer;
  font: inherit;
  height: 22px;
  line-height: 1;
  padding: 0;
  position: absolute;
  right: 6px;
  top: 6px;
  width: 22px;
}

.mk-swatch {
  border: 1px solid #1f1f1f;
  border-radius: 50%;
  cursor: pointer;
  height: 24px;
  padding: 0;
  width: 24px;
}

.mk-swatch[aria-pressed="true"] {
  border-color: #1f1f1f;
  outline: 2px solid #1f1f1f;
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
  background: #d8d8d8;
  border: 2px solid #1f1f1f;
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
  background: #d8d8d8;
  border: 2px solid #1f1f1f;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 8%);
  break-inside: avoid;
  margin: 0 0 16px;
  padding: 12px 14px;
  position: relative;
}

.mk-card.is-selected {
  border-color: #1f1f1f;
  box-shadow: inset 4px 0 0 #1f1f1f, 0 1px 3px rgb(0 0 0 / 8%);
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
  color: #555555;
  cursor: pointer;
  font: inherit;
  padding: 2px 6px;
}

.mk-card__pin:hover,
.mk-card__delete:hover,
.mk-card__pin:focus-visible,
.mk-card__delete:focus-visible {
  background: #e4e4e4;
  color: #303030;
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
  color: #555555;
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
  color: #555555;
}

.mk-sidebar__title {
  font-size: 13px;
  letter-spacing: 0.04em;
  margin: 0;
}

.mk-labels__header {
  align-items: center;
  display: flex;
  gap: 8px;
  justify-content: space-between;
}

.mk-label-list {
  display: grid;
  gap: 2px;
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
}

.mk-label-list__empty {
  color: #6b7480;
  font-size: 13px;
}

.mk-label-link {
  align-items: center;
  border-radius: 999px;
  color: #1b1f24;
  display: flex;
  gap: 8px;
  justify-content: space-between;
  padding: 6px 12px;
  text-decoration: none;
}

.mk-label-link:hover,
.mk-label-link:focus-visible {
  background: #f3f6fa;
}

.mk-label-link.is-active {
  background: #e5ecf5;
  font-weight: 600;
}

.mk-label-link__count {
  font-size: 12px;
  opacity: 0.7;
}

.mk-label-manager {
  background: #f8fafc;
  border: 1px solid #d8dde3;
  border-radius: 8px;
  display: grid;
  gap: 8px;
  padding: 10px;
}

.mk-label-manager__create,
.mk-label-manager__row {
  align-items: center;
  display: flex;
  gap: 6px;
}

.mk-label-manager__list {
  display: grid;
  gap: 6px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.mk-label-manager__input {
  border: 1px solid #d8dde3;
  border-radius: 4px;
  font: inherit;
  min-width: 0;
  padding: 4px 6px;
  width: 100%;
}

.mk-card__labels {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
}

.mk-label-chip {
  background: rgb(255 255 255 / 70%);
  border: 1px solid #d8dde3;
  border-radius: 999px;
  display: inline-block;
  font-size: 12px;
  padding: 1px 8px;
}

.mk-composer__labels {
  border: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 8px 0 0;
  padding: 0;
}

.mk-composer__labels legend {
  color: #6b7480;
  font-size: 12px;
  padding: 0;
}

.mk-composer__label {
  align-items: center;
  display: inline-flex;
  font-size: 13px;
  gap: 4px;
}

.mk-bulk-bar__labels {
  align-items: center;
  display: flex;
  gap: 4px;
}

.mk-bulk-bar__label-select {
  border: 1px solid #d8dde3;
  border-radius: 4px;
  font: inherit;
  padding: 2px 4px;
}

.mk-snackbar {
  align-items: center;
  background: #1b1f24;
  border-radius: 8px;
  bottom: 20px;
  color: #fff;
  display: flex;
  gap: 12px;
  left: 50%;
  padding: 10px 16px;
  position: fixed;
  transform: translateX(-50%);
  z-index: 40;
}

.mk-snackbar .button {
  background: #fff;
  color: #1b1f24;
}

.mk-dates,
.mk-sort,
.mk-saved {
  display: grid;
  gap: 6px;
}

.mk-dates__row,
.mk-sort__row {
  align-items: center;
  display: flex;
  gap: 6px;
  justify-content: space-between;
}

.mk-dates__row select,
.mk-dates__row input,
.mk-sort__row select,
.mk-saved__input {
  background: #ffffff;
  border: 1px solid #bdbdbd;
  border-radius: 4px;
  font: inherit;
  min-width: 0;
  padding: 3px 6px;
}

.mk-dates__actions {
  align-items: center;
  display: flex;
  gap: 8px;
}

.mk-dates__clear {
  color: #555555;
  font-size: 16px;
  text-decoration: none;
}

.mk-dates__active {
  color: #555555;
  font-size: 12px;
  margin: 0;
}

.mk-saved__create {
  display: flex;
  gap: 6px;
}

.mk-saved__input {
  flex: 1 1 auto;
}

.mk-saved__empty {
  color: #555555;
  font-size: 12px;
  margin: 0;
}

.mk-saved__list {
  display: grid;
  gap: 4px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.mk-saved__row {
  align-items: center;
  display: flex;
  gap: 4px;
}

.mk-saved__name {
  color: #303030;
  flex: 1 1 auto;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mk-saved__action {
  background: transparent;
  border: 0;
  color: #555555;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  padding: 2px 4px;
}

.mk-theme {
  align-items: center;
  display: flex;
  gap: 6px;
}

.mk-theme__select {
  background: #ffffff;
  border: 1px solid #bdbdbd;
  border-radius: 4px;
  font: inherit;
  padding: 3px 6px;
}

.mk-card__preview-fetch {
  background: transparent;
  border: 0;
  border-radius: 4px;
  color: #555555;
  cursor: pointer;
  font: inherit;
  padding: 2px 6px;
}

.mk-card__preview {
  display: grid;
  gap: 8px;
  grid-template-columns: 72px minmax(0, 1fr);
  margin-top: 8px;
}

.mk-card__preview-image {
  border: 1px solid #bdbdbd;
  border-radius: 6px;
  height: 72px;
  object-fit: cover;
  width: 72px;
}

.mk-card__preview-text {
  min-width: 0;
}

.mk-card__link {
  color: #1b4b8f;
  font-size: 12px;
  text-decoration: none;
}

.mk-card__preview-title {
  font-size: 13px;
  font-weight: 700;
  margin: 2px 0 0;
}

.mk-card__preview-description {
  color: #555555;
  font-size: 12px;
  line-height: 1.4;
  margin: 2px 0 0;
  max-height: 54px;
  overflow: hidden;
}

.mk-card__plain-link {
  margin: 8px 0 0;
}

/* MK だけのダークテーマ。MyKeep の暗色値を [data-mk-page] 配下に限定して適用する。 */
html[data-theme="dark"] .page--mk {
  background: #18191b;
  color: #eeeae0;
}

html[data-theme="dark"] .page--mk .mk-card {
  background: #2c2e31;
  border-color: #55565a;
}

html[data-theme="dark"] .page--mk .mk-card--red {
  background: #563433;
}

html[data-theme="dark"] .page--mk .mk-card--orange {
  background: #58402d;
}

html[data-theme="dark"] .page--mk .mk-card--yellow {
  background: #544b2d;
}

html[data-theme="dark"] .page--mk .mk-card--green {
  background: #304a37;
}

html[data-theme="dark"] .page--mk .mk-card--blue {
  background: #2c4059;
}

html[data-theme="dark"] .page--mk .mk-card--purple {
  background: #473851;
}

html[data-theme="dark"] .page--mk .mk-card__body,
html[data-theme="dark"] .page--mk .mk-card__preview-description,
html[data-theme="dark"] .page--mk .mk-empty,
html[data-theme="dark"] .page--mk .mk-dates__active,
html[data-theme="dark"] .page--mk .mk-saved__empty,
html[data-theme="dark"] .page--mk .muted {
  color: #bcbdbd;
}

html[data-theme="dark"] .page--mk .mk-card__link {
  color: #a3caff;
}

html[data-theme="dark"] .page--mk .mk-filter,
html[data-theme="dark"] .page--mk .mk-label-link,
html[data-theme="dark"] .page--mk .mk-saved__name {
  color: #eeeae0;
}

html[data-theme="dark"] .page--mk .mk-filter:hover,
html[data-theme="dark"] .page--mk .mk-filter:focus-visible {
  background: #2c2e31;
}

html[data-theme="dark"] .page--mk .mk-filter.is-active {
  background: #2c2e31;
  border-color: #55565a;
  color: #eeeae0;
}

html[data-theme="dark"] .page--mk .mk-composer,
html[data-theme="dark"] .page--mk .mk-bulk-bar,
html[data-theme="dark"] .page--mk .mk-label-manager {
  background: #2c2e31;
  border-color: #55565a;
  color: #eeeae0;
}

html[data-theme="dark"] .page--mk input,
html[data-theme="dark"] .page--mk select,
html[data-theme="dark"] .page--mk textarea {
  background: #232527;
  border-color: #55565a;
  color: #eeeae0;
}

html[data-theme="dark"] .page--mk .mk-label-chip {
  background: #3a3c40;
  border-color: #55565a;
  color: #eeeae0;
}
`;
