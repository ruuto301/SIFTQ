export const IDEA_CSS = `
.page--idea {
  background: transparent;
  color: #303030;
  margin: 0 auto;
  max-width: 1400px;
  min-height: calc(100vh - 63px);
  padding: 24px 16px 48px;
}

.idea-layout {
  display: grid;
  gap: 24px;
  grid-template-columns: minmax(0, 1fr);
}

@media (width >= 60rem) {
  .idea-layout {
    grid-template-columns: 220px minmax(0, 1fr);
  }
}

.idea-sidebar {
  align-self: start;
  display: grid;
  gap: 16px;
}

.idea-filters {
  display: grid;
  gap: 4px;
}

.idea-filter {
  align-items: center;
  border-radius: 999px;
  color: #303030;
  display: flex;
  gap: 8px;
  justify-content: space-between;
  padding: 8px 12px;
  text-decoration: none;
}

.idea-filter:hover,
.idea-filter:focus-visible {
  background: #e4e4e4;
}

.idea-filter.is-active {
  background: #262626;
  border: 2px solid #dcdcdc;
  color: #dcdcdc;
}

.idea-filter__count {
  font-size: 12px;
  opacity: 0.7;
}

.idea-color-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.idea-color-filter {
  border: 2px solid #1f1f1f;
  border-radius: 999px;
  display: inline-flex;
  padding: 3px;
}

.idea-color-filter.is-active {
  background: #262626;
  border-color: #dcdcdc;
}

.idea-color-filter__dot {
  border: 1px solid #1f1f1f;
  border-radius: 50%;
  display: block;
  height: 18px;
  width: 18px;
}

.idea-color-filter__dot--default {
  background: #2c2e31;
}

.idea-color-filter__dot--red {
  background: #563433;
}

.idea-color-filter__dot--orange {
  background: #58402d;
}

.idea-color-filter__dot--yellow {
  background: #544b2d;
}

.idea-color-filter__dot--green {
  background: #304a37;
}

.idea-color-filter__dot--blue {
  background: #2c4059;
}

.idea-color-filter__dot--purple {
  background: #473851;
}

.idea-main {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.idea-toolbar {
  align-items: center;
  display: flex;
  gap: 12px;
}

.idea-search {
  align-items: center;
  display: flex;
  flex: 1 1 auto;
  gap: 8px;
  min-width: 0;
}

.idea-search input[type="search"] {
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

.idea-composer {
  background: #d8d8d8;
  border: 2px solid #1f1f1f;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 8%);
}

.idea-composer__trigger {
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

.idea-composer--open .idea-composer__trigger {
  display: none;
}

.idea-composer__editor {
  display: grid;
  gap: 12px;
  padding: 16px;
}

.idea-composer__editor[hidden] {
  display: none;
}

.idea-composer__title,
.idea-composer__body {
  background: transparent;
  border: 0;
  color: #303030;
  font: inherit;
  outline: 0;
  padding: 0;
  width: 100%;
}

.idea-composer__title {
  font-size: 17px;
  font-weight: 700;
}

.idea-composer__body {
  line-height: 1.55;
  min-height: 44px;
  overflow: hidden;
  resize: none;
}

.idea-composer__colors,
.idea-composer__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.idea-composer__images[hidden],
.idea-composer__error[hidden] {
  display: none;
}

.idea-composer__image-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.idea-composer__image {
  position: relative;
}

.idea-composer__image-thumb {
  border: 1px solid #bdbdbd;
  border-radius: 6px;
  display: block;
  height: 72px;
  object-fit: cover;
  width: 72px;
}

.idea-composer__image-remove {
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

.idea-composer__error {
  color: #1f1f1f;
  font-size: 13px;
  margin: 0;
}

.idea-composer__attachments {
  align-items: center;
  display: flex;
  gap: 8px;
  justify-content: flex-start;
}

.idea-composer__hint {
  color: #555555;
  font-size: 11px;
}

.idea-composer__file {
  height: 1px;
  opacity: 0;
  overflow: hidden;
  position: absolute;
  width: 1px;
}

.idea-card__image-wrap {
  margin-top: 8px;
  position: relative;
}

.idea-card__image {
  border-radius: 6px;
  display: block;
  height: 120px;
  object-fit: cover;
  width: 100%;
}

.idea-card__image-remove {
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

.idea-swatch {
  border: 1px solid #eeeae0a6;
  border-radius: 50%;
  cursor: pointer;
  height: 24px;
  padding: 0;
  width: 24px;
}

.idea-swatch[aria-pressed="true"] {
  border-color: #ffffff;
  box-shadow: 0 0 0 2px #ffffff33;
  outline: 2px solid #1f1f1f;
  outline-offset: 1px;
}

.idea-swatch--default {
  background: #2c2e31;
}

.idea-swatch--red {
  background: #563433;
}

.idea-swatch--orange {
  background: #58402d;
}

.idea-swatch--yellow {
  background: #544b2d;
}

.idea-swatch--green {
  background: #304a37;
}

.idea-swatch--blue {
  background: #2c4059;
}

.idea-swatch--purple {
  background: #473851;
}

/* 入る分だけ並べ、余れば次の行へ折り返す（最大幅 1400px の中で 4 列前後になる）。 */
.idea-grid {
  align-items: start;
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
}

.idea-card {
  background: #d8d8d8;
  border: 2px solid #1f1f1f;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 8%);
  padding: 12px 14px;
  position: relative;
}

.idea-card.is-selected {
  border-color: #1f1f1f;
  box-shadow: inset 4px 0 0 #1f1f1f, 0 1px 3px rgb(0 0 0 / 8%);
}

.idea-card__actions {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
}

.idea-card__pin {
  background: transparent;
  border: 0;
  border-radius: 4px;
  color: #eeeae0;
  cursor: pointer;
  font: inherit;
  padding: 2px 6px;
}

.idea-card__pin:hover,
.idea-card__pin:focus-visible {
  background: #ffffff1f;
}

.idea-card__pin svg {
  fill: none;
  height: 16px;
  stroke: currentColor;
  stroke-width: 1.5;
  width: 16px;
}

/* ピン中は輪郭を強調する（塗りは使わない: 背景色と同化するため） */
.idea-card[data-idea-pinned="true"] .idea-card__pin svg {
  stroke-width: 2;
}

.idea-card__title {
  font-size: 16px;
  line-height: 1.4;
  margin: 8px 0 0;
  overflow-wrap: anywhere;
}

.idea-card__body {
  color: #555555;
  font-size: 14px;
  line-height: 1.55;
  margin: 8px 0 0;
  max-height: 336px;
  overflow: hidden;
  white-space: pre-wrap;
}

.idea-card--default {
  background: #ffffff;
}

.idea-card--red {
  background: #ffe9e7;
}

.idea-card--orange {
  background: #ffeddc;
}

.idea-card--yellow {
  background: #fff5cf;
}

.idea-card--green {
  background: #e4f3df;
}

.idea-card--blue {
  background: #e1efff;
}

.idea-card--purple {
  background: #efe7fb;
}

.idea-empty {
  color: #555555;
}

.idea-sidebar__title {
  font-size: 13px;
  letter-spacing: 0.04em;
  margin: 0;
}

.idea-snackbar {
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

.idea-snackbar .button {
  background: #fff;
  color: #1b1f24;
}

.idea-dates,
.idea-sort,
.idea-saved {
  display: grid;
  gap: 6px;
}

.idea-dates__row,
.idea-sort__row {
  align-items: center;
  display: flex;
  gap: 6px;
  justify-content: space-between;
}

.idea-dates__row select,
.idea-dates__row input,
.idea-sort__row select,
.idea-saved__input {
  background: #ffffff;
  border: 1px solid #bdbdbd;
  border-radius: 4px;
  font: inherit;
  min-width: 0;
  padding: 3px 6px;
}

.idea-dates__actions {
  align-items: center;
  display: flex;
  gap: 8px;
}

.idea-dates__clear {
  color: #555555;
  font-size: 16px;
  text-decoration: none;
}

.idea-dates__active {
  color: #555555;
  font-size: 12px;
  margin: 0;
}

.idea-saved__create {
  display: flex;
  gap: 6px;
}

.idea-saved__input {
  flex: 1 1 auto;
}

.idea-saved__empty {
  color: #555555;
  font-size: 12px;
  margin: 0;
}

.idea-saved__list {
  display: grid;
  gap: 4px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.idea-saved__row {
  align-items: center;
  display: flex;
  gap: 4px;
}

.idea-saved__name {
  color: #303030;
  flex: 1 1 auto;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.idea-saved__action {
  background: transparent;
  border: 0;
  color: #555555;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  padding: 2px 4px;
}

.idea-card__preview {
  display: grid;
  gap: 8px;
  grid-template-columns: 72px minmax(0, 1fr);
  margin-top: 8px;
}

.idea-card__preview-image {
  border: 1px solid #bdbdbd;
  border-radius: 6px;
  height: 72px;
  object-fit: cover;
  width: 72px;
}

.idea-card__preview-text {
  min-width: 0;
}

.idea-card__link {
  color: #1b4b8f;
  font-size: 12px;
  text-decoration: none;
}

.idea-card__preview-title {
  font-size: 13px;
  font-weight: 700;
  margin: 2px 0 0;
}

.idea-card__preview-description {
  color: #555555;
  font-size: 12px;
  line-height: 1.4;
  margin: 2px 0 0;
  max-height: 54px;
  overflow: hidden;
}

.idea-card__plain-link {
  margin: 8px 0 0;
}

/* Keep 踏襲: カードはダーク配色に固定（文字は明るい色） */
.idea-card {
  border-color: #00000026;
  color: #eeeae0;
}

.idea-card__title {
  color: #eeeae0;
}

.idea-card__body {
  color: #eeeae0d9;
}

.idea-card__link,
.idea-card__plain-link {
  background: #ffffff14;
  border-color: #ffffff33;
  color: #eeeae0;
}

.idea-card__preview {
  background: #ffffff14;
  border-color: #ffffff2e;
}

.idea-card__preview-title,
.idea-card__preview-description {
  color: #eeeae0cc;
}

.idea-card--default { background: #2c2e31; }
.idea-card--red { background: #563433; }
.idea-card--orange { background: #58402d; }
.idea-card--yellow { background: #544b2d; }
.idea-card--green { background: #304a37; }
.idea-card--blue { background: #2c4059; }
.idea-card--purple { background: #473851; }

/* Keep: カードの操作はホバー/フォーカスで出し、ピン中は常に出す */
.idea-card__actions {
  position: absolute;
  right: 8px;
  top: 8px;
  visibility: hidden;
}

.idea-card[data-idea-pinned="true"] .idea-card__actions,
.idea-card:hover .idea-card__actions,
.idea-card:focus-within .idea-card__actions {
  visibility: visible;
}

@media (hover: none) {
  .idea-card__actions { visibility: visible; }
}

/* 検索欄の右に置く絞り込みメニュー */
.idea-menu {
  position: relative;
}

.idea-menu__panel {
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
.idea-detail {
  align-items: center;
  display: flex;
  inset: 0;
  justify-content: center;
  position: fixed;
  z-index: 100;
}

.idea-detail[hidden] {
  display: none !important;
}

.idea-detail__backdrop {
  background: rgb(32 33 36 / 50%);
  inset: 0;
  position: absolute;
}

.idea-detail__dialog {
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

.idea-detail__dialog[data-idea-color="default"] { background: #2c2e31; }
.idea-detail__dialog[data-idea-color="red"] { background: #563433; }
.idea-detail__dialog[data-idea-color="orange"] { background: #58402d; }
.idea-detail__dialog[data-idea-color="yellow"] { background: #544b2d; }
.idea-detail__dialog[data-idea-color="green"] { background: #304a37; }
.idea-detail__dialog[data-idea-color="blue"] { background: #2c4059; }
.idea-detail__dialog[data-idea-color="purple"] { background: #473851; }

.idea-detail__head {
  align-items: flex-start;
  display: flex;
  gap: 8px;
  padding: 16px 16px 0;
}

.idea-detail__title {
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

.idea-detail__pin {
  background: transparent;
  border: 0;
  border-radius: 50%;
  color: #eeeae0a6;
  cursor: pointer;
  font-size: 14px;
  height: 30px;
  width: 30px;
}

.idea-detail__pin[aria-pressed="true"] {
  background: #ffffff26;
  color: #ffffff;
}

/* 本文側だけがスクロールする（本文欄は中身に合わせて伸びる）。 */
.idea-detail__body {
  min-height: 0;
  overflow-y: auto;
  scrollbar-color: #ffffff59 transparent;
  scrollbar-width: thin;
}

.idea-detail__body::-webkit-scrollbar {
  width: 8px;
}

.idea-detail__body::-webkit-scrollbar-thumb {
  background: #ffffff59;
  border-radius: 8px;
}

.idea-detail__text {
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

.idea-detail__images {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 16px 0;
}

.idea-detail__thumb {
  position: relative;
}

.idea-detail__thumb img {
  border-radius: 6px;
  height: 72px;
  object-fit: cover;
  width: 96px;
}

.idea-detail__thumb button {
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

.idea-detail__bar {
  align-items: center;
  display: flex;
  gap: 2px;
  padding: 8px 10px 10px;
}

.idea-detail__icon {
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

.idea-detail__icon:hover {
  background: #ffffff1f;
}

.idea-detail__more {
  position: relative;
}

.idea-detail__more summary::-webkit-details-marker {
  display: none;
}

.idea-detail__menu {
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

.idea-detail__menu button,
.idea-detail__menu select {
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

.idea-detail__menu button:hover {
  background: #f1f3f4;
}

.idea-detail__swatches {
  display: flex;
  gap: 6px;
  padding: 0 6px;
}

.idea-detail__swatches[hidden] {
  display: none;
}

.idea-detail__close {
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

.idea-detail__error {
  color: #ffb4a9;
  font-size: 12px;
  margin: 0 16px 10px;
}

.idea-detail__error[hidden] {
  display: none;
}

`;
