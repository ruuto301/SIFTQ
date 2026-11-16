export const MK_CSS = `
.page--mk {
  background: transparent;
  color: #303030;
  margin: 0 auto;
  max-width: 1400px;
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
}

.mk-search {
  align-items: center;
  display: flex;
  flex: 1 1 auto;
  gap: 8px;
  min-width: 0;
}

.mk-search input[type="search"] {
  background: #e4e4e4;
  border: 2px solid #1f1f1f;
  border-radius: 999px;
  color: #303030;
  flex: 1 1 auto;
  font: inherit;
  min-width: 0;
  padding: 6px 14px;
  width: 100%;
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
  min-height: 44px;
  overflow: hidden;
  resize: none;
}

.mk-composer__colors,
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

/* 入る分だけ並べ、余れば次の行へ折り返す（最大幅 1400px の中で 4 列前後になる）。 */
.mk-grid {
  align-items: start;
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
}

.mk-card {
  background: #d8d8d8;
  border: 2px solid #1f1f1f;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 8%);
  padding: 12px 14px;
  position: relative;
}

.mk-card.is-selected {
  border-color: #1f1f1f;
  box-shadow: inset 4px 0 0 #1f1f1f, 0 1px 3px rgb(0 0 0 / 8%);
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

/* Keep 踏襲: カードはダーク配色に固定（文字は明るい色） */
.mk-card {
  border-color: #00000026;
  color: #eeeae0;
}

.mk-card__title {
  color: #eeeae0;
}

.mk-card__body {
  color: #eeeae0d9;
}

.mk-card__link,
.mk-card__plain-link {
  background: #ffffff14;
  border-color: #ffffff33;
  color: #eeeae0;
}

.mk-card__preview {
  background: #ffffff14;
  border-color: #ffffff2e;
}

.mk-card__preview-title,
.mk-card__preview-description {
  color: #eeeae0cc;
}

.mk-card--default { background: #2c2e31; }
.mk-card--red { background: #563433; }
.mk-card--orange { background: #58402d; }
.mk-card--yellow { background: #544b2d; }
.mk-card--green { background: #304a37; }
.mk-card--blue { background: #2c4059; }
.mk-card--purple { background: #473851; }

/* Keep: カードの操作はホバー/フォーカスで出す */
.mk-card__actions {
  visibility: hidden;
}

.mk-card:hover .mk-card__actions,
.mk-card:focus-within .mk-card__actions {
  visibility: visible;
}

@media (hover: none) {
  .mk-card__actions { visibility: visible; }
}

.mk-card__pin-badge {
  color: #eeeae0a6;
  font-size: 12px;
  margin-left: auto;
}

/* 検索欄の右に置く絞り込みメニュー */
.mk-menu {
  position: relative;
}

.mk-menu__panel {
  background: #ffffff;
  border: 1px solid #d8dde3;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgb(31 35 40 / 16%);
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  position: absolute;
  right: 0;
  top: 34px;
  width: 280px;
  z-index: 20;
}

/* Keep のノート画面 */
.mk-detail {
  align-items: center;
  display: flex;
  inset: 0;
  justify-content: center;
  position: fixed;
  z-index: 100;
}

.mk-detail[hidden] {
  display: none !important;
}

.mk-detail__backdrop {
  background: rgb(32 33 36 / 50%);
  inset: 0;
  position: absolute;
}

.mk-detail__dialog {
  background: #2c2e31;
  border-radius: 8px;
  box-shadow: 0 12px 32px rgb(0 0 0 / 32%);
  color: #eeeae0;
  display: flex;
  flex-direction: column;
  max-height: 86vh;
  max-width: calc(100vw - 32px);
  position: relative;
  width: 620px;
}

.mk-detail__dialog[data-mk-color="default"] { background: #2c2e31; }
.mk-detail__dialog[data-mk-color="red"] { background: #563433; }
.mk-detail__dialog[data-mk-color="orange"] { background: #58402d; }
.mk-detail__dialog[data-mk-color="yellow"] { background: #544b2d; }
.mk-detail__dialog[data-mk-color="green"] { background: #304a37; }
.mk-detail__dialog[data-mk-color="blue"] { background: #2c4059; }
.mk-detail__dialog[data-mk-color="purple"] { background: #473851; }

.mk-detail__head {
  align-items: flex-start;
  display: flex;
  gap: 8px;
  padding: 16px 16px 0;
}

.mk-detail__title {
  background: transparent;
  border: 0;
  color: #eeeae0;
  flex: 1;
  font: inherit;
  font-size: 19px;
  font-weight: 600;
  min-width: 0;
  padding: 0;
}

.mk-detail__pin {
  background: transparent;
  border: 0;
  border-radius: 50%;
  color: #eeeae0a6;
  cursor: pointer;
  font-size: 14px;
  height: 30px;
  width: 30px;
}

.mk-detail__pin[aria-pressed="true"] {
  background: #ffffff26;
  color: #ffffff;
}

/* 本文側だけがスクロールする（本文欄は中身に合わせて伸びる）。 */
.mk-detail__body {
  min-height: 0;
  overflow-y: auto;
  scrollbar-color: #ffffff59 transparent;
  scrollbar-width: thin;
}

.mk-detail__body::-webkit-scrollbar {
  width: 8px;
}

.mk-detail__body::-webkit-scrollbar-thumb {
  background: #ffffff59;
  border-radius: 8px;
}

.mk-detail__text {
  background: transparent;
  border: 0;
  color: #eeeae0e6;
  display: block;
  font: inherit;
  font-size: 13px;
  line-height: 1.7;
  margin: 4px 16px 0;
  min-height: 0;
  overflow: hidden;
  resize: none;
  width: calc(100% - 32px);
}

.mk-detail__images {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 16px 0;
}

.mk-detail__thumb {
  position: relative;
}

.mk-detail__thumb img {
  border-radius: 6px;
  height: 72px;
  object-fit: cover;
  width: 96px;
}

.mk-detail__thumb button {
  background: #1b1f24;
  border: 0;
  border-radius: 50%;
  color: #ffffff;
  cursor: pointer;
  font-size: 10px;
  height: 18px;
  position: absolute;
  right: -6px;
  top: -6px;
  width: 18px;
}

.mk-detail__bar {
  align-items: center;
  display: flex;
  gap: 2px;
  padding: 8px 10px 10px;
}

.mk-detail__icon {
  background: transparent;
  border: 0;
  border-radius: 50%;
  color: #eeeae0d9;
  cursor: pointer;
  font-size: 13px;
  height: 30px;
  list-style: none;
  width: 30px;
}

.mk-detail__icon:hover {
  background: #ffffff1f;
}

.mk-detail__more {
  position: relative;
}

.mk-detail__more summary::-webkit-details-marker {
  display: none;
}

.mk-detail__menu {
  background: #ffffff;
  border-radius: 6px;
  bottom: 36px;
  box-shadow: 0 2px 10px rgb(0 0 0 / 30%);
  color: #1b1f24;
  display: flex;
  flex-direction: column;
  gap: 2px;
  left: 0;
  padding: 6px;
  position: absolute;
  width: 176px;
  z-index: 5;
}

.mk-detail__menu button,
.mk-detail__menu select {
  background: transparent;
  border: 0;
  border-radius: 4px;
  color: inherit;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  padding: 6px 8px;
  text-align: left;
}

.mk-detail__menu button:hover {
  background: #f1f3f4;
}

.mk-detail__swatches {
  display: flex;
  gap: 6px;
  padding: 0 6px;
}

.mk-detail__swatches[hidden] {
  display: none;
}

.mk-detail__close {
  background: transparent;
  border: 0;
  color: #eeeae0d9;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  margin-left: auto;
  padding: 6px 14px;
}

.mk-detail__error {
  color: #ffb4a9;
  font-size: 12px;
  margin: 0 16px 10px;
}

.mk-detail__error[hidden] {
  display: none;
}

`;
