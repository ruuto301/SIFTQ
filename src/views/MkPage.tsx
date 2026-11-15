import { MK_COLORS, MK_DATE_KINDS, MK_DEFAULT_SORT, mkSortParts } from "../mk";
import type { MkColor, MkCounts, MkDateKind, MkFilter, MkImage, MkLabel, MkNote, MkSort } from "../mk";
import { extractMkPreviewUrl } from "../mk-link-preview";

const MK_FILTER_LABELS: Record<MkFilter, string> = {
  notes: "メモ",
  pinned: "ピンあり",
  unpinned: "ピンなし",
  archived: "アーカイブ",
  trash: "ゴミ箱",
};

const MK_DATE_KIND_LABELS: Record<MkDateKind, string> = {
  created: "作成日",
  updated: "更新日",
};

/** Every list control reads and writes this one shape, so a link can carry the whole filter. */
export type MkState = {
  readonly filter: MkFilter;
  readonly labelId: string;
  readonly query: string;
  readonly color: MkColor | undefined;
  readonly dateKind: MkDateKind | undefined;
  readonly from: string | undefined;
  readonly to: string | undefined;
  readonly sort: MkSort | undefined;
};

export function mkListHref(state: MkState): string {
  const params = new URLSearchParams();
  params.set("filter", state.filter);
  if (state.labelId !== "") params.set("label", state.labelId);
  if (state.query.trim() !== "") params.set("q", state.query);
  if (state.color !== undefined) params.set("color", state.color);
  if (state.dateKind !== undefined && (state.from !== undefined || state.to !== undefined)) {
    params.set("dateKind", state.dateKind);
  }
  if (state.from !== undefined) params.set("from", state.from);
  if (state.to !== undefined) params.set("to", state.to);
  if (state.sort !== undefined) params.set("sort", state.sort);
  return `/mk?${params.toString()}`;
}

function activeDateRange(state: MkState): boolean {
  return (state.from !== undefined || state.to !== undefined) && state.dateKind !== undefined;
}

function mkRangeLabel(state: MkState): string {
  const kind = state.dateKind === undefined ? "created" : state.dateKind;
  return `${MK_DATE_KIND_LABELS[kind]}: ${state.from?.slice(0, 10) ?? ""} 〜 ${state.to?.slice(0, 10) ?? ""}`;
}

function MkComposerColors() {
  return (
    <div class="mk-composer__colors" role="group" aria-label="メモの色">
      {MK_COLORS.map((color) => (
        <button
          key={color}
          class={`mk-swatch mk-swatch--${color}`}
          type="button"
          data-mk-composer-color={color}
          aria-label={`${color} の色`}
          aria-pressed={color === "default" ? "true" : "false"}
        />
      ))}
    </div>
  );
}

function MkComposerAttachments() {
  return (
    <div class="mk-composer__attachments">
      <span class="mk-composer__hint">📋 Ctrl+V で画像を貼り付け</span>
      <button class="button small" type="button" data-mk-composer-image-add>
        画像を追加
      </button>
      <input
        class="mk-composer__file"
        type="file"
        accept="image/png,image/webp,image/jpeg"
        multiple
        tabindex={-1}
        aria-hidden="true"
        data-mk-composer-file
      />
    </div>
  );
}

function MkComposerLabels({ labels }: { readonly labels: readonly MkLabel[] }) {
  if (labels.length === 0) return null;
  return (
    <fieldset class="mk-composer__labels" data-mk-composer-labels>
      <legend>ラベル</legend>
      {labels.map((label) => (
        <label class="mk-composer__label" key={label.id}>
          <input type="checkbox" value={label.id} data-mk-composer-label />
          <span>{label.name}</span>
        </label>
      ))}
    </fieldset>
  );
}

function MkComposer({ labels }: { readonly labels: readonly MkLabel[] }) {
  return (
    <div class="mk-composer" data-mk-composer data-mk-composer-open="false" data-mk-color="default">
      <button class="mk-composer__trigger" type="button" data-mk-composer-trigger aria-expanded="false">
        <span>メモを取る...</span>
      </button>
      <div class="mk-composer__editor" data-mk-composer-editor hidden>
        <input
          class="mk-composer__title"
          name="title"
          type="text"
          maxlength={256}
          autocomplete="off"
          placeholder="新しいメモのタイトル"
          aria-label="メモのタイトル"
          data-mk-composer-title
        />
        <textarea
          class="mk-composer__body"
          name="body"
          rows={3}
          placeholder="本文。Ctrl+V で画像を貼り付けできます。"
          aria-label="メモの本文"
          data-mk-composer-body
        ></textarea>
        <MkComposerColors />
        <MkComposerLabels labels={labels} />
        <div class="mk-composer__images" data-mk-composer-images hidden>
          <ul class="mk-composer__image-list" data-mk-composer-image-list></ul>
        </div>
        <p class="mk-composer__error" data-mk-composer-error role="status" hidden></p>
        <MkComposerAttachments />
        <div class="mk-composer__actions">
          <button class="button small" type="button" data-mk-composer-cancel data-cancel>
            キャンセル
          </button>
          <button class="button small primary" type="button" data-mk-composer-save>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

function MkLabelManager({ labels }: { readonly labels: readonly MkLabel[] }) {
  return (
    <div class="mk-label-manager" data-mk-label-manager role="group" aria-label="ラベルを管理" hidden>
      <form class="mk-label-manager__create" data-mk-label-create-form>
        <input
          class="mk-label-manager__input"
          type="text"
          maxlength={100}
          placeholder="新しいラベル"
          aria-label="新しいラベル名"
          data-mk-label-create-input
        />
        <button class="button small primary" type="submit" data-mk-label-create>
          作成
        </button>
      </form>
      <ul class="mk-label-manager__list">
        {labels.map((label) => (
          <li class="mk-label-manager__row" key={label.id}>
            <input
              class="mk-label-manager__input"
              type="text"
              maxlength={100}
              value={label.name}
              aria-label={`${label.name} の名前`}
              data-mk-label-rename-input={label.id}
            />
            <button class="button small" type="button" data-mk-label-rename={label.id}>
              保存
            </button>
            <button class="button small button--danger" type="button" data-mk-label-delete={label.id}>
              削除
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

type SidebarProps = {
  readonly counts: MkCounts;
  readonly labels: readonly MkLabel[];
  readonly state: MkState;
};

const MK_NAV_FILTERS = ["notes", "archived", "trash"] as const satisfies readonly MkFilter[];

function MkFilterLinks({ counts, state }: SidebarProps) {
  return (
    <nav class="mk-filters" aria-label="メモの絞り込み">
      {MK_NAV_FILTERS.map((candidate) => (
        <a
          key={candidate}
          class={candidate === state.filter ? "mk-filter is-active" : "mk-filter"}
          aria-current={candidate === state.filter ? "true" : undefined}
          href={mkListHref({ ...state, filter: candidate })}
        >
          <span class="mk-filter__label">{MK_FILTER_LABELS[candidate]}</span>
          <span class="mk-filter__count" data-mk-count={candidate}>
            {counts[candidate]}
          </span>
        </a>
      ))}
    </nav>
  );
}

function MkColorFilters({ state }: SidebarProps) {
  return (
    <div class="mk-color-filters" role="group" aria-label="色で絞り込む">
      {MK_COLORS.map((candidate) => {
        const active = state.color === candidate;
        return (
          <a
            key={candidate}
            class={active ? "mk-color-filter is-active" : "mk-color-filter"}
            aria-current={active ? "true" : undefined}
            // The active color clears the filter so the row keeps the agreed seven swatches.
            href={mkListHref({ ...state, color: active ? undefined : candidate })}
            data-mk-color-filter={candidate}
            aria-label={active ? `${candidate} の絞り込みを解除` : `${candidate} のメモ`}
          >
            <span class={`mk-color-filter__dot mk-color-filter__dot--${candidate}`} />
          </a>
        );
      })}
    </div>
  );
}

function MkDateRange({ state }: SidebarProps) {
  const kind = state.dateKind ?? "created";
  const active = activeDateRange(state);
  return (
    <form class="mk-dates" action="/mk" method="get" data-mk-date-form>
      <h2 class="mk-sidebar__title">期間</h2>
      <input type="hidden" name="filter" value={state.filter} />
      {state.labelId === "" ? null : <input type="hidden" name="label" value={state.labelId} />}
      {state.color === undefined ? null : <input type="hidden" name="color" value={state.color} />}
      {state.query.trim() === "" ? null : <input type="hidden" name="q" value={state.query} />}
      {state.sort === undefined ? null : <input type="hidden" name="sort" value={state.sort} />}
      <label class="mk-dates__row">
        <span>対象</span>
        <select name="dateKind" data-mk-date-kind>
          {MK_DATE_KINDS.map((candidate) => (
            <option key={candidate} value={candidate} selected={candidate === kind}>
              {MK_DATE_KIND_LABELS[candidate]}
            </option>
          ))}
        </select>
      </label>
      <label class="mk-dates__row">
        <span>開始日</span>
        <input type="date" name="fromDate" value={state.from?.slice(0, 10) ?? ""} data-mk-date-from />
        <input type="hidden" name="from" data-mk-date-from-value />
      </label>
      <label class="mk-dates__row">
        <span>終了日</span>
        <input type="date" name="toDate" value={state.to?.slice(0, 10) ?? ""} data-mk-date-to />
        <input type="hidden" name="to" data-mk-date-to-value />
      </label>
      <div class="mk-dates__actions">
        <button class="button small" type="submit">
          適用
        </button>
        {active ? (
          <a
            class="mk-dates__clear"
            href={mkListHref({ ...state, from: undefined, to: undefined })}
            data-mk-date-clear
            aria-label="期間を解除"
          >
            ×
          </a>
        ) : null}
      </div>
      {active ? (
        <p class="mk-dates__active" data-mk-date-active>
          {mkRangeLabel(state)}
        </p>
      ) : null}
    </form>
  );
}

function MkSortControl({ state }: SidebarProps) {
  const parts = mkSortParts(state.sort ?? MK_DEFAULT_SORT);
  return (
    <div class="mk-sort" data-mk-sort>
      <h2 class="mk-sidebar__title">並び順</h2>
      <label class="mk-sort__row">
        <span>基準</span>
        <select data-mk-sort-field>
          <option value="updated" selected={parts.field === "updated"}>
            更新日
          </option>
          <option value="created" selected={parts.field === "created"}>
            作成日
          </option>
        </select>
      </label>
      <label class="mk-sort__row">
        <span>順序</span>
        <select data-mk-sort-direction>
          <option value="desc" selected={parts.direction === "desc"}>
            新しい順
          </option>
          <option value="asc" selected={parts.direction === "asc"}>
            古い順
          </option>
        </select>
      </label>
    </div>
  );
}

function MkSavedSearches() {
  return (
    <div class="mk-saved" data-mk-saved-searches>
      <h2 class="mk-sidebar__title">保存した検索</h2>
      <form class="mk-saved__create" data-mk-saved-create>
        <input
          class="mk-saved__input"
          type="text"
          maxlength={50}
          placeholder="検索名"
          aria-label="保存する検索名"
          data-mk-saved-name
        />
        <button class="button small" type="submit" data-mk-saved-save>
          保存
        </button>
      </form>
      <p class="mk-saved__empty" data-mk-saved-empty>
        保存した検索はありません。
      </p>
      <ul class="mk-saved__list" data-mk-saved-list></ul>
    </div>
  );
}

function MkLabelSection({ counts, labels, state }: SidebarProps) {
  return (
    <div class="mk-labels">
      <div class="mk-labels__header">
        <h2 class="mk-sidebar__title">ラベル</h2>
        <button class="button small" type="button" data-mk-label-manage>
          ラベルを管理
        </button>
      </div>
      <ul class="mk-label-list">
        {labels.length === 0 ? <li class="mk-label-list__empty">ラベルはありません。</li> : null}
        {labels.map((label) => (
          <li key={label.id}>
            <a
              class={label.id === state.labelId ? "mk-label-link is-active" : "mk-label-link"}
              aria-current={label.id === state.labelId ? "true" : undefined}
              href={mkListHref({ ...state, labelId: label.id })}
              data-mk-label-link={label.id}
            >
              <span class="mk-label-link__name">{label.name}</span>
              <span class="mk-label-link__count" data-mk-label-count={label.id}>
                {counts.labels[label.id] ?? 0}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MkSidebar({ counts, labels, state }: SidebarProps) {
  return (
    <aside class="mk-sidebar">
      <MkFilterLinks counts={counts} labels={labels} state={state} />
      <MkLabelSection counts={counts} labels={labels} state={state} />
      <MkLabelManager labels={labels} />
    </aside>
  );
}

/** Keep の「⋯」に相当する、検索欄の右に置く絞り込みメニュー。 */
function MkFilterMenu({ counts, labels, state }: SidebarProps) {
  return (
    <details class="mk-menu" data-mk-filter-menu>
      <summary class="button small">絞り込み</summary>
      <div class="mk-menu__panel">
        <MkColorFilters counts={counts} labels={labels} state={state} />
        <MkDateRange counts={counts} labels={labels} state={state} />
        <MkSortControl counts={counts} labels={labels} state={state} />
        <MkSavedSearches />
      </div>
    </details>
  );
}

/** ラベルを選ぶ select。一括操作と詳細ダイアログで同じ中身を使う。 */
function MkLabelSelect({
  labels,
  attribute,
  placeholder,
  ariaLabel,
  className,
}: {
  readonly labels: readonly MkLabel[];
  readonly attribute: "data-mk-bulk-label" | "data-mk-detail-label-add";
  readonly placeholder: string;
  readonly ariaLabel: string;
  readonly className?: string;
}) {
  const attrs: Record<string, string> = { [attribute]: "" };
  return (
    <select class={className} aria-label={ariaLabel} {...attrs}>
      <option value="">{placeholder}</option>
      {labels.map((label) => (
        <option key={label.id} value={label.id}>
          {label.name}
        </option>
      ))}
    </select>
  );
}

function MkBulkBar({ labels }: { readonly labels: readonly MkLabel[] }) {
  return (
    <div class="mk-bulk-bar" data-mk-bulk-bar role="toolbar" aria-label="選択したメモの操作" hidden>
      <span class="mk-bulk-bar__count" data-mk-selection-count>
        0件選択
      </span>
      <label class="mk-bulk-bar__select-all">
        <input type="checkbox" data-mk-select-all aria-label="すべて選択" />
      </label>
      <div class="mk-bulk-bar__colors" role="group" aria-label="色を変更">
        {MK_COLORS.map((candidate) => (
          <button
            key={candidate}
            class={`mk-swatch mk-swatch--${candidate}`}
            type="button"
            data-mk-bulk-color={candidate}
            aria-label={`${candidate} に変更`}
          />
        ))}
      </div>
      <button class="button small" type="button" data-mk-bulk-pin>
        ピン
      </button>
      <button class="button small" type="button" data-mk-bulk-archive>
        アーカイブ
      </button>
      <button class="button small" type="button" data-mk-bulk-trash>
        ゴミ箱へ
      </button>
      <button class="button small" type="button" data-mk-bulk-restore>
        復元
      </button>
      <button class="button small button--danger" type="button" data-mk-bulk-purge>
        完全削除
      </button>
      <div class="mk-bulk-bar__labels">
        <MkLabelSelect
          labels={labels}
          attribute="data-mk-bulk-label"
          placeholder="ラベル"
          ariaLabel="ラベルを選択"
          className="mk-bulk-bar__label-select"
        />
        <button class="button small" type="button" data-mk-bulk-label-add>
          追加
        </button>
        <button class="button small" type="button" data-mk-bulk-label-remove>
          解除
        </button>
      </div>
      <button class="button small" type="button" data-mk-bulk-delete>
        削除
      </button>
      <button class="button small" type="button" data-mk-bulk-clear>
        選択解除
      </button>
    </div>
  );
}

function MkCardLabels({ labels }: { readonly labels: readonly MkLabel[] }) {
  if (labels.length === 0) return null;
  return (
    <ul class="mk-card__labels">
      {labels.map((label) => (
        <li key={label.id}>
          <span class="mk-label-chip" data-mk-card-label={label.id}>
            {label.name}
          </span>
        </li>
      ))}
    </ul>
  );
}

function MkCardActions({ note }: { readonly note: MkNote }) {
  return (
    <div class="mk-card__actions">
      <button class="mk-card__preview-fetch" type="button" data-mk-preview-fetch aria-label="リンクプレビューを取得">
        🔗 プレビュー取得
      </button>
      <button
        class="mk-card__pin"
        type="button"
        data-mk-pin
        aria-pressed={note.pinned ? "true" : "false"}
        aria-label={note.pinned ? "ピンを外す" : "ピンする"}
      >
        <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
          <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.8v6h2.4v-6H20v-2z" />
        </svg>
      </button>
      <button class="mk-card__delete" type="button" data-mk-delete aria-label="削除">
        ×
      </button>
    </div>
  );
}

function MkCardImage({ image }: { readonly image: MkImage | undefined }) {
  if (image === undefined) return null;
  return (
    <div class="mk-card__image-wrap">
      <img class="mk-card__image" src={`/api/images/${encodeURIComponent(image.image_id)}`} alt="" loading="lazy" />
      <button class="mk-card__image-remove" type="button" data-mk-image-remove={image.id} aria-label="画像を削除">
        ×
      </button>
    </div>
  );
}

function mkPreviewDomain(note: MkNote, url: string): string {
  if (note.preview_domain !== null && note.preview_domain !== "") return note.preview_domain;
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function hasMkPreview(note: MkNote): boolean {
  return note.preview_domain !== null || note.preview_title !== null || note.preview_image !== null;
}

/** The note body keeps the raw link; the card upgrades it to a preview once metadata exists. */
function MkCardPreview({ note }: { readonly note: MkNote }) {
  const url = extractMkPreviewUrl(`${note.title}\n${note.body}`);
  if (url === null) return null;
  const link = (
    <a class="mk-card__link" href={url} target="_blank" rel="noopener noreferrer nofollow" data-mk-link>
      {mkPreviewDomain(note, url)}
    </a>
  );
  if (!hasMkPreview(note)) return <p class="mk-card__plain-link">{link}</p>;
  return (
    <div class="mk-card__preview" data-mk-preview>
      {note.preview_image === null ? null : (
        <img
          class="mk-card__preview-image"
          src={note.preview_image}
          alt=""
          loading="lazy"
          decoding="async"
          referrerpolicy="no-referrer"
        />
      )}
      <div class="mk-card__preview-text">
        {link}
        {note.preview_title === null ? null : <p class="mk-card__preview-title">{note.preview_title}</p>}
        {note.preview_description === null ? null : (
          <p class="mk-card__preview-description">{note.preview_description}</p>
        )}
      </div>
    </div>
  );
}

function MkCard({
  note,
  images,
  labels,
}: {
  readonly note: MkNote;
  readonly images: readonly MkImage[];
  readonly labels: readonly MkLabel[];
}) {
  return (
    <article
      class={`mk-card mk-card--${note.color}`}
      data-mk-id={note.id}
      data-mk-color={note.color}
      data-mk-pinned={note.pinned ? "true" : "false"}
      data-mk-labels={labels.map((label) => label.id).join(",")}
      data-mk-title={note.title}
      data-mk-body={note.body}
      data-mk-images={JSON.stringify(
        images.map((image) => ({
          link: image.id,
          src: `/api/images/${encodeURIComponent(image.image_id)}`,
        })),
      )}
      data-mk-open
    >
      <label class="mk-card__select-label">
        <input class="mk-card__select" type="checkbox" data-mk-select aria-label={`${note.title} を選択`} />
      </label>
      <MkCardActions note={note} />
      {note.pinned ? (
        <span class="mk-card__pin-badge" aria-hidden="true">
          📌
        </span>
      ) : null}
      <h2 class="mk-card__title">{note.title}</h2>
      <MkCardImage image={images[0]} />
      {note.body === "" ? null : <p class="mk-card__body">{note.body}</p>}
      <MkCardPreview note={note} />
      <MkCardLabels labels={labels} />
    </article>
  );
}

function MkSearch({ state }: { readonly state: MkState }) {
  return (
    <form class="mk-search" action="/mk" method="get" data-mk-search>
      <input type="hidden" name="filter" value={state.filter} />
      {state.labelId === "" ? null : <input type="hidden" name="label" value={state.labelId} />}
      {state.color === undefined ? null : <input type="hidden" name="color" value={state.color} />}
      {state.dateKind === undefined || !activeDateRange(state) ? null : (
        <input type="hidden" name="dateKind" value={state.dateKind} />
      )}
      {state.from === undefined ? null : <input type="hidden" name="from" value={state.from} />}
      {state.to === undefined ? null : <input type="hidden" name="to" value={state.to} />}
      {state.sort === undefined ? null : <input type="hidden" name="sort" value={state.sort} />}
      <input
        type="search"
        name="q"
        aria-label="メモを検索"
        value={state.query}
        placeholder="メモを検索（タイトル / 本文）"
        data-mk-search-input
      />
      {state.query.trim() === "" ? null : (
        <a
          class="mk-search__clear"
          href={mkListHref({ ...state, query: "" })}
          aria-label="検索を解除"
          data-mk-search-clear
        >
          ×
        </a>
      )}
    </form>
  );
}

/** Keep の「⋯」: ゴミ箱へ / 削除 / ラベル追加。 */
function MkDetailMoreMenu({ labels }: { readonly labels: readonly MkLabel[] }) {
  return (
    <details class="mk-detail__more">
      <summary class="mk-detail__icon" aria-label="その他">
        ⋯
      </summary>
      <div class="mk-detail__menu">
        <button type="button" data-mk-detail-trash>
          ゴミ箱へ
        </button>
        <button type="button" data-mk-detail-delete>
          削除
        </button>
        <MkLabelSelect
          labels={labels}
          attribute="data-mk-detail-label-add"
          placeholder="ラベルを追加"
          ariaLabel="ラベルを追加"
        />
      </div>
    </details>
  );
}

function MkDetailSwatches() {
  return (
    <div class="mk-detail__swatches" data-mk-detail-swatches hidden>
      {MK_COLORS.map((color) => (
        <button
          key={color}
          class={`mk-swatch mk-swatch--${color}`}
          type="button"
          data-mk-detail-color={color}
          aria-label={`${color} に変更`}
        />
      ))}
    </div>
  );
}

/**
 * Keep のノート画面に合わせた詳細ダイアログ。実際の値はカードから JS が流し込む。
 */
function MkDetailDialog({ labels }: { readonly labels: readonly MkLabel[] }) {
  return (
    <div class="mk-detail" data-mk-detail hidden>
      <div class="mk-detail__backdrop" data-mk-detail-backdrop />
      <div
        class="mk-detail__dialog"
        data-mk-detail-dialog
        role="dialog"
        aria-modal="true"
        aria-label="メモの詳細"
      >
        <div class="mk-detail__head">
          <input
            class="mk-detail__title"
            type="text"
            maxlength={256}
            aria-label="メモのタイトル"
            data-mk-detail-title
          />
          <button
            class="mk-detail__pin"
            type="button"
            data-mk-detail-pin
            aria-pressed="false"
            aria-label="ピン"
          >
            📌
          </button>
        </div>
        <textarea
          class="mk-detail__text"
          rows={8}
          maxlength={16384}
          aria-label="メモの本文"
          data-mk-detail-body
        />
        <div class="mk-detail__images" data-mk-detail-images />
        <div class="mk-detail__labels" data-mk-detail-labels />
        <div class="mk-detail__bar">
          <button class="mk-detail__icon" type="button" data-mk-detail-archive aria-label="アーカイブ">
            🗄
          </button>
          <MkDetailMoreMenu labels={labels} />
          <button class="mk-detail__icon" type="button" data-mk-detail-palette aria-label="背景色">
            🎨
          </button>
          <MkDetailSwatches />
          <button class="mk-detail__close" type="button" data-mk-detail-close>
            閉じる
          </button>
        </div>
        <p class="mk-detail__error" data-mk-detail-error role="alert" hidden />
      </div>
    </div>
  );
}

function MkSnackbar() {
  return (
    <div class="mk-snackbar" data-mk-snackbar role="status" hidden>
      <span class="mk-snackbar__message" data-mk-snackbar-message></span>
      <button class="button small" type="button" data-mk-snackbar-undo>
        取り消す
      </button>
    </div>
  );
}

function MkHeader() {
  return (
    <div class="page-header">
      <div>
        <h1 class="page-title">MK</h1>
      </div>
    </div>
  );
}

function MkGrid({
  notes,
  labelsByNote,
  images,
}: {
  readonly notes: readonly MkNote[];
  readonly labelsByNote: Readonly<Record<string, readonly MkLabel[]>>;
  readonly images: Readonly<Record<string, readonly MkImage[]>>;
}) {
  if (notes.length === 0) {
    return (
      <p class="mk-empty" data-mk-empty>
        メモはありません。
      </p>
    );
  }
  return (
    <div class="mk-grid" data-mk-grid>
      {notes.map((note) => (
        <MkCard key={note.id} note={note} images={images[note.id] ?? []} labels={labelsByNote[note.id] ?? []} />
      ))}
    </div>
  );
}

export function MkPage({
  notes,
  counts,
  labels,
  labelsByNote,
  state,
  images,
}: {
  readonly notes: readonly MkNote[];
  readonly counts: MkCounts;
  readonly labels: readonly MkLabel[];
  readonly labelsByNote: Readonly<Record<string, readonly MkLabel[]>>;
  readonly state: MkState;
  readonly images: Readonly<Record<string, readonly MkImage[]>>;
}) {
  return (
    <div class="page page--mk" data-mk-page data-mk-selecting="false" data-mk-sort={state.sort ?? MK_DEFAULT_SORT}>
      <MkHeader />
      <div class="mk-layout">
        <MkSidebar counts={counts} labels={labels} state={state} />
        <section class="mk-main">
          <div class="mk-toolbar">
            <MkSearch state={state} />
            <MkFilterMenu counts={counts} labels={labels} state={state} />
            <button class="button small" type="button" data-mk-selection-toggle aria-pressed="false">
              ☑ 選択
            </button>
          </div>
          <MkBulkBar labels={labels} />
          <MkComposer labels={labels} />
          <MkGrid notes={notes} labelsByNote={labelsByNote} images={images} />
        </section>
      </div>
      <MkDetailDialog labels={labels} />
      <MkSnackbar />
    </div>
  );
}
