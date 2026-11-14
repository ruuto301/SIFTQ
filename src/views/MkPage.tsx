import { MK_COLORS } from "../mk";
import type { MkColor, MkFilter, MkNote } from "../mk";

export type MkNoteCounts = { all: number; pinned: number; unpinned: number };

const MK_FILTER_LABELS: Record<MkFilter, string> = {
  all: "メモ",
  pinned: "ピンあり",
  unpinned: "ピンなし",
};

export function mkListHref(filter: MkFilter, query: string, color: MkColor | undefined): string {
  const params = new URLSearchParams();
  params.set("filter", filter);
  if (query.trim() !== "") params.set("q", query);
  if (color !== undefined) params.set("color", color);
  return `/mk?${params.toString()}`;
}

function MkComposer() {
  return (
    <div class="mk-composer" data-mk-composer data-mk-composer-open="false" data-mk-color="default">
      <button class="mk-composer__trigger" type="button" data-mk-composer-trigger aria-expanded="false">
        <span>メモを入力...</span>
      </button>
      <div class="mk-composer__editor" data-mk-composer-editor hidden>
        <input
          class="mk-composer__title"
          name="title"
          type="text"
          maxlength={256}
          autocomplete="off"
          placeholder="タイトル"
          aria-label="メモのタイトル"
          data-mk-composer-title
        />
        <textarea
          class="mk-composer__body"
          name="body"
          rows={3}
          placeholder="メモを入力..."
          aria-label="メモの本文"
          data-mk-composer-body
        ></textarea>
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

function MkSidebar({
  counts,
  filter,
  query,
  color,
}: {
  readonly counts: MkNoteCounts;
  readonly filter: MkFilter;
  readonly query: string;
  readonly color: MkColor | undefined;
}) {
  return (
    <aside class="mk-sidebar">
      <nav class="mk-filters" aria-label="メモの絞り込み">
        {(["all", "pinned", "unpinned"] as const).map((candidate) => (
          <a
            key={candidate}
            class={candidate === filter ? "mk-filter is-active" : "mk-filter"}
            aria-current={candidate === filter ? "true" : undefined}
            href={mkListHref(candidate, query, color)}
          >
            <span class="mk-filter__label">{MK_FILTER_LABELS[candidate]}</span>
            <span class="mk-filter__count" data-mk-count={candidate}>
              {counts[candidate]}
            </span>
          </a>
        ))}
      </nav>
      <div class="mk-color-filters" role="group" aria-label="色で絞り込む">
        <a
          class={color === undefined ? "mk-color-filter is-active" : "mk-color-filter"}
          aria-current={color === undefined ? "true" : undefined}
          href={mkListHref(filter, query, undefined)}
          data-mk-color-filter="all"
          aria-label="すべての色"
        >
          <span class="mk-color-filter__dot mk-color-filter__dot--all" />
        </a>
        {MK_COLORS.map((candidate) => (
          <a
            key={candidate}
            class={color === candidate ? "mk-color-filter is-active" : "mk-color-filter"}
            aria-current={color === candidate ? "true" : undefined}
            href={mkListHref(filter, query, candidate)}
            data-mk-color-filter={candidate}
            aria-label={`${candidate} のメモ`}
          >
            <span class={`mk-color-filter__dot mk-color-filter__dot--${candidate}`} />
          </a>
        ))}
      </div>
    </aside>
  );
}

function MkBulkBar() {
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
      <button class="button small button--danger" type="button" data-mk-bulk-delete>
        削除
      </button>
      <button class="button small" type="button" data-mk-bulk-clear>
        選択解除
      </button>
    </div>
  );
}

function MkCard({ note }: { readonly note: MkNote }) {
  return (
    <article
      class={`mk-card mk-card--${note.color}`}
      data-mk-id={note.id}
      data-mk-color={note.color}
      data-mk-pinned={note.pinned ? "true" : "false"}
    >
      <label class="mk-card__select-label">
        <input class="mk-card__select" type="checkbox" data-mk-select aria-label={`${note.title} を選択`} />
      </label>
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
      <h2 class="mk-card__title">{note.title}</h2>
      {note.body === "" ? null : <p class="mk-card__body">{note.body}</p>}
    </article>
  );
}

function MkSearch({ filter, query, color }: { readonly filter: MkFilter; readonly query: string; readonly color: MkColor | undefined }) {
  return (
    <form class="mk-search" action="/mk" method="get" data-mk-search>
      <input type="hidden" name="filter" value={filter} />
      {color === undefined ? null : <input type="hidden" name="color" value={color} />}
      <input
        type="search"
        name="q"
        aria-label="メモを検索"
        value={query}
        placeholder="検索"
        data-mk-search-input
      />
      <button class="button small" type="submit" aria-label="検索を実行">
        検索
      </button>
    </form>
  );
}

export function MkPage({
  notes,
  counts,
  filter,
  query,
  color,
}: {
  readonly notes: readonly MkNote[];
  readonly counts: MkNoteCounts;
  readonly filter: MkFilter;
  readonly query: string;
  readonly color: MkColor | undefined;
}) {
  return (
    <div class="page page--mk" data-mk-page data-mk-selecting="false">
      <div class="page-header">
        <div>
          <h1 class="page-title">MK</h1>
          <p class="muted">メモを色とピンで整理する。</p>
        </div>
      </div>
      <div class="mk-layout">
        <MkSidebar counts={counts} filter={filter} query={query} color={color} />
        <section class="mk-main">
          <div class="mk-toolbar">
            <MkSearch filter={filter} query={query} color={color} />
            <button class="button small" type="button" data-mk-selection-toggle aria-pressed="false">
              選択
            </button>
          </div>
          <MkBulkBar />
          <MkComposer />
          {notes.length === 0 ? (
            <p class="mk-empty" data-mk-empty>
              メモはありません。
            </p>
          ) : null}
          <div class="mk-grid" data-mk-grid>
            {notes.map((note) => (
              <MkCard key={note.id} note={note} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
