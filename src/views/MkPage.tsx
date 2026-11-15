import { MK_COLORS, MK_FILTERS } from "../mk";
import type { MkColor, MkCounts, MkFilter, MkImage, MkLabel, MkNote } from "../mk";

const MK_FILTER_LABELS: Record<MkFilter, string> = {
  notes: "メモ",
  pinned: "ピンあり",
  unpinned: "ピンなし",
  archived: "アーカイブ",
  trash: "ゴミ箱",
};

export function mkListHref(filter: MkFilter, query: string, color: MkColor | undefined, labelId = ""): string {
  const params = new URLSearchParams();
  params.set("filter", filter);
  if (labelId !== "") params.set("label", labelId);
  if (query.trim() !== "") params.set("q", query);
  if (color !== undefined) params.set("color", color);
  return `/mk?${params.toString()}`;
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
        <span>＋ 新規メモ</span>
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
  readonly filter: MkFilter;
  readonly labelId: string;
  readonly query: string;
  readonly color: MkColor | undefined;
};

function MkFilterLinks({ counts, filter, labelId, query, color }: SidebarProps) {
  return (
    <nav class="mk-filters" aria-label="メモの絞り込み">
      {MK_FILTERS.map((candidate) => (
        <a
          key={candidate}
          class={candidate === filter ? "mk-filter is-active" : "mk-filter"}
          aria-current={candidate === filter ? "true" : undefined}
          href={mkListHref(candidate, query, color, labelId)}
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

function MkColorFilters({ filter, labelId, query, color }: SidebarProps) {
  return (
    <div class="mk-color-filters" role="group" aria-label="色で絞り込む">
      {MK_COLORS.map((candidate) => {
        const active = color === candidate;
        return (
          <a
            key={candidate}
            class={active ? "mk-color-filter is-active" : "mk-color-filter"}
            aria-current={active ? "true" : undefined}
            // The active color clears the filter so the row keeps the agreed seven swatches.
            href={active ? mkListHref(filter, query, undefined, labelId) : mkListHref(filter, query, candidate, labelId)}
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

function MkLabelSection({ counts, labels, filter, labelId, query, color }: SidebarProps) {
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
              class={label.id === labelId ? "mk-label-link is-active" : "mk-label-link"}
              aria-current={label.id === labelId ? "true" : undefined}
              href={mkListHref(filter, query, color, label.id)}
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

function MkSidebar({ counts, labels, filter, labelId, query, color }: SidebarProps) {
  return (
    <aside class="mk-sidebar">
      <button class="mk-side-new" type="button" data-mk-side-new>
        ＋ 新規メモ
      </button>
      <MkFilterLinks counts={counts} labels={labels} filter={filter} labelId={labelId} query={query} color={color} />
      <MkColorFilters counts={counts} labels={labels} filter={filter} labelId={labelId} query={query} color={color} />
      <MkLabelSection counts={counts} labels={labels} filter={filter} labelId={labelId} query={query} color={color} />
      <MkLabelManager labels={labels} />
    </aside>
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
        <select class="mk-bulk-bar__label-select" data-mk-bulk-label aria-label="ラベルを選択">
          <option value="">ラベル</option>
          {labels.map((label) => (
            <option key={label.id} value={label.id}>
              {label.name}
            </option>
          ))}
        </select>
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
    >
      <label class="mk-card__select-label">
        <input class="mk-card__select" type="checkbox" data-mk-select aria-label={`${note.title} を選択`} />
      </label>
      <MkCardActions note={note} />
      <h2 class="mk-card__title">{note.title}</h2>
      <MkCardImage image={images[0]} />
      {note.body === "" ? null : <p class="mk-card__body">{note.body}</p>}
      <MkCardLabels labels={labels} />
    </article>
  );
}

function MkSearch({
  filter,
  labelId,
  query,
  color,
}: {
  readonly filter: MkFilter;
  readonly labelId: string;
  readonly query: string;
  readonly color: MkColor | undefined;
}) {
  return (
    <form class="mk-search" action="/mk" method="get" data-mk-search>
      <input type="hidden" name="filter" value={filter} />
      {labelId === "" ? null : <input type="hidden" name="label" value={labelId} />}
      {color === undefined ? null : <input type="hidden" name="color" value={color} />}
      <input
        type="search"
        name="q"
        aria-label="メモを検索"
        value={query}
        placeholder="メモを検索（タイトル / 本文）"
        data-mk-search-input
      />
      {query.trim() === "" ? null : (
        <a
          class="mk-search__clear"
          href={mkListHref(filter, "", color)}
          aria-label="検索を解除"
          data-mk-search-clear
        >
          ×
        </a>
      )}
    </form>
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

export function MkPage({
  notes,
  counts,
  labels,
  labelsByNote,
  filter,
  labelId,
  query,
  color,
  images,
}: {
  readonly notes: readonly MkNote[];
  readonly counts: MkCounts;
  readonly labels: readonly MkLabel[];
  readonly labelsByNote: Readonly<Record<string, readonly MkLabel[]>>;
  readonly filter: MkFilter;
  readonly labelId: string;
  readonly query: string;
  readonly color: MkColor | undefined;
  readonly images: Readonly<Record<string, readonly MkImage[]>>;
}) {
  return (
    <div class="page page--mk" data-mk-page data-mk-selecting="false">
      <div class="page-header">
        <div>
          <h1 class="page-title">MK</h1>
          <p class="muted">メモを色とピンとラベルで整理する。</p>
        </div>
      </div>
      <div class="mk-layout">
        <MkSidebar counts={counts} labels={labels} filter={filter} labelId={labelId} query={query} color={color} />
        <section class="mk-main">
          <div class="mk-toolbar">
            <MkSearch filter={filter} labelId={labelId} query={query} color={color} />
            <button class="button small" type="button" data-mk-selection-toggle aria-pressed="false">
              ☑ 選択
            </button>
          </div>
          <MkBulkBar labels={labels} />
          <MkComposer labels={labels} />
          {notes.length === 0 ? (
            <p class="mk-empty" data-mk-empty>
              メモはありません。
            </p>
          ) : null}
          <div class="mk-grid" data-mk-grid>
            {notes.map((note) => (
              <MkCard key={note.id} note={note} images={images[note.id] ?? []} labels={labelsByNote[note.id] ?? []} />
            ))}
          </div>
        </section>
      </div>
      <MkSnackbar />
    </div>
  );
}
