import type { JSX } from "hono/jsx/jsx-runtime";
import { IDEA_COLORS, IDEA_DATE_KINDS, IDEA_DEFAULT_SORT, ideaSortParts } from "../idea";
import type { IdeaColor, IdeaNoteCounts, IdeaDateKind, IdeaFilter, IdeaImage, IdeaNote, IdeaSort } from "../idea";
import { splitDescription } from "../description";
import type { DescriptionSegment } from "../description";
import {
  IDEA_ATTACHMENT_CONTENT_TYPES,
  formatIdeaAttachmentBytes,
  ideaAttachmentKind,
} from "../idea-attachment";
import type { IdeaAttachment } from "../idea-attachment";
import { extractIdeaPreviewUrl } from "../idea-link-preview";
import { displayHostname, displayUrl } from "../url-display";

const IDEA_ATTACHMENT_ACCEPT = IDEA_ATTACHMENT_CONTENT_TYPES.join(",");

const IDEA_FILTER_LABELS: Record<IdeaFilter, string> = {
  notes: "メモ",
  pinned: "ピンあり",
  unpinned: "ピンなし",
  archived: "アーカイブ",
  trash: "ゴミ箱",
};

const IDEA_DATE_KIND_LABELS: Record<IdeaDateKind, string> = {
  created: "作成日",
  updated: "更新日",
};

/** Every list control reads and writes this one shape, so a link can carry the whole filter. */
export type IdeaState = {
  readonly filter: IdeaFilter;
  readonly query: string;
  readonly color: IdeaColor | undefined;
  readonly dateKind: IdeaDateKind | undefined;
  readonly from: string | undefined;
  readonly to: string | undefined;
  readonly sort: IdeaSort | undefined;
};

export function ideaListHref(state: IdeaState): string {
  const params = new URLSearchParams();
  params.set("filter", state.filter);
  if (state.query.trim() !== "") params.set("q", state.query);
  if (state.color !== undefined) params.set("color", state.color);
  if (state.dateKind !== undefined && (state.from !== undefined || state.to !== undefined)) {
    params.set("dateKind", state.dateKind);
  }
  if (state.from !== undefined) params.set("from", state.from);
  if (state.to !== undefined) params.set("to", state.to);
  if (state.sort !== undefined) params.set("sort", state.sort);
  return `/ideas?${params.toString()}`;
}

function activeDateRange(state: IdeaState): boolean {
  return (state.from !== undefined || state.to !== undefined) && state.dateKind !== undefined;
}

function ideaRangeLabel(state: IdeaState): string {
  const kind = state.dateKind === undefined ? "created" : state.dateKind;
  return `${IDEA_DATE_KIND_LABELS[kind]}: ${state.from?.slice(0, 10) ?? ""} 〜 ${state.to?.slice(0, 10) ?? ""}`;
}

function IdeaComposerColors() {
  return (
    <div class="idea-composer__colors" role="group" aria-label="メモの色">
      {IDEA_COLORS.map((color) => (
        <button
          key={color}
          class={`idea-swatch idea-swatch--${color}`}
          type="button"
          data-idea-composer-color={color}
          aria-label={`${color} の色`}
          aria-pressed={color === "default" ? "true" : "false"}
        />
      ))}
    </div>
  );
}

function IdeaComposerAttachments() {
  return (
    <div class="idea-composer__attachments">
      <span class="idea-composer__hint">📋 Ctrl+V で画像を貼り付け</span>
      <span class="idea-composer__hint">📎 PDF・テキスト等はドロップ / 選択で添付</span>
      <button class="button small" type="button" data-idea-composer-image-add>
        ファイルを追加
      </button>
      <input
        class="idea-composer__file"
        type="file"
        accept={IDEA_ATTACHMENT_ACCEPT}
        multiple
        tabindex={-1}
        aria-hidden="true"
        data-idea-composer-file
      />
    </div>
  );
}

function IdeaComposer() {
  return (
    <div class="idea-composer" data-idea-composer data-idea-composer-open="false" data-idea-color="default">
      <button class="idea-composer__trigger" type="button" data-idea-composer-trigger aria-expanded="false">
        <span>メモを取る...</span>
      </button>
      <div class="idea-composer__editor" data-idea-composer-editor hidden>
        <input
          class="idea-composer__title"
          name="title"
          type="text"
          maxlength={256}
          autocomplete="off"
          placeholder="新しいメモのタイトル"
          aria-label="メモのタイトル"
          data-idea-composer-title
        />
        <textarea
          class="idea-composer__body"
          name="body"
          rows={3}
          placeholder="本文。Ctrl+V で画像を貼り付けできます。"
          aria-label="メモの本文"
          data-idea-composer-body
        ></textarea>
        <IdeaComposerColors />
        <div class="idea-composer__images" data-idea-composer-images hidden>
          <ul class="idea-composer__image-list" data-idea-composer-image-list></ul>
        </div>
        <p class="idea-composer__error" data-idea-composer-error role="status" hidden></p>
        <button class="button small" type="button" data-idea-composer-retry hidden>
          再試行
        </button>
        <IdeaComposerAttachments />
        <div class="idea-composer__actions">
          <button class="button small" type="button" data-idea-composer-cancel data-cancel>
            キャンセル
          </button>
          <button class="button small primary" type="button" data-idea-composer-save>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

type SidebarProps = {
  readonly counts: IdeaNoteCounts;
  readonly state: IdeaState;
};

const IDEA_NAV_FILTERS = ["notes", "archived", "trash"] as const satisfies readonly IdeaFilter[];

function IdeaFilterLinks({ counts, state }: SidebarProps) {
  return (
    <nav class="idea-filters" aria-label="メモの絞り込み">
      {IDEA_NAV_FILTERS.map((candidate) => (
        <a
          key={candidate}
          class={candidate === state.filter ? "idea-filter is-active" : "idea-filter"}
          aria-current={candidate === state.filter ? "true" : undefined}
          href={ideaListHref({ ...state, filter: candidate })}
        >
          <span class="idea-filter__label">{IDEA_FILTER_LABELS[candidate]}</span>
          <span class="idea-filter__count" data-idea-count={candidate}>
            {counts[candidate]}
          </span>
        </a>
      ))}
    </nav>
  );
}

function IdeaColorFilters({ state }: SidebarProps) {
  return (
    <div class="idea-color-filters" role="group" aria-label="色で絞り込む">
      {IDEA_COLORS.map((candidate) => {
        const active = state.color === candidate;
        return (
          <a
            key={candidate}
            class={active ? "idea-color-filter is-active" : "idea-color-filter"}
            aria-current={active ? "true" : undefined}
            // The active color clears the filter so the row keeps the agreed seven swatches.
            href={ideaListHref({ ...state, color: active ? undefined : candidate })}
            data-idea-color-filter={candidate}
            aria-label={active ? `${candidate} の絞り込みを解除` : `${candidate} のメモ`}
          >
            <span class={`idea-color-filter__dot idea-color-filter__dot--${candidate}`} />
          </a>
        );
      })}
    </div>
  );
}

function IdeaDateRange({ state }: SidebarProps) {
  const kind = state.dateKind ?? "created";
  const active = activeDateRange(state);
  return (
    <form class="idea-dates" action="/ideas" method="get" data-idea-date-form>
      <h2 class="idea-sidebar__title">期間</h2>
      <input type="hidden" name="filter" value={state.filter} />
      {state.color === undefined ? null : <input type="hidden" name="color" value={state.color} />}
      {state.query.trim() === "" ? null : <input type="hidden" name="q" value={state.query} />}
      {state.sort === undefined ? null : <input type="hidden" name="sort" value={state.sort} />}
      <label class="idea-dates__row">
        <span>対象</span>
        <select name="dateKind" data-idea-date-kind>
          {IDEA_DATE_KINDS.map((candidate) => (
            <option key={candidate} value={candidate} selected={candidate === kind}>
              {IDEA_DATE_KIND_LABELS[candidate]}
            </option>
          ))}
        </select>
      </label>
      <label class="idea-dates__row">
        <span>開始日</span>
        <input type="date" name="fromDate" value={state.from?.slice(0, 10) ?? ""} data-idea-date-from />
        <input type="hidden" name="from" data-idea-date-from-value />
      </label>
      <label class="idea-dates__row">
        <span>終了日</span>
        <input type="date" name="toDate" value={state.to?.slice(0, 10) ?? ""} data-idea-date-to />
        <input type="hidden" name="to" data-idea-date-to-value />
      </label>
      <div class="idea-dates__actions">
        <button class="button small" type="submit">
          適用
        </button>
        {active ? (
          <a
            class="idea-dates__clear"
            href={ideaListHref({ ...state, from: undefined, to: undefined })}
            data-idea-date-clear
            aria-label="期間を解除"
          >
            ×
          </a>
        ) : null}
      </div>
      {active ? (
        <p class="idea-dates__active" data-idea-date-active>
          {ideaRangeLabel(state)}
        </p>
      ) : null}
    </form>
  );
}

function IdeaSortControl({ state }: SidebarProps) {
  const parts = ideaSortParts(state.sort ?? IDEA_DEFAULT_SORT);
  return (
    <div class="idea-sort" data-idea-sort>
      <h2 class="idea-sidebar__title">並び順</h2>
      <label class="idea-sort__row">
        <span>基準</span>
        <select data-idea-sort-field>
          <option value="updated" selected={parts.field === "updated"}>
            更新日
          </option>
          <option value="created" selected={parts.field === "created"}>
            作成日
          </option>
        </select>
      </label>
      <label class="idea-sort__row">
        <span>順序</span>
        <select data-idea-sort-direction>
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

function IdeaSavedSearches() {
  return (
    <div class="idea-saved" data-idea-saved-searches>
      <h2 class="idea-sidebar__title">保存した検索</h2>
      <form class="idea-saved__create" data-idea-saved-create>
        <input
          class="idea-saved__input"
          type="text"
          maxlength={50}
          placeholder="検索名"
          aria-label="保存する検索名"
          data-idea-saved-name
        />
        <button class="button small" type="submit" data-idea-saved-save>
          保存
        </button>
      </form>
      <p class="idea-saved__empty" data-idea-saved-empty>
        保存した検索はありません。
      </p>
      <ul class="idea-saved__list" data-idea-saved-list></ul>
    </div>
  );
}

function IdeaSidebar({ counts, state }: SidebarProps) {
  return (
    <aside class="idea-sidebar">
      <IdeaFilterLinks counts={counts} state={state} />
    </aside>
  );
}

/** Keep の「⋯」に相当する、検索欄の右に置く絞り込みメニュー。 */
function IdeaFilterMenu({ counts, state }: SidebarProps) {
  return (
    <details class="idea-menu" data-idea-filter-menu>
      <summary class="button small">絞り込み</summary>
      <div class="idea-menu__panel">
        <IdeaColorFilters counts={counts} state={state} />
        <IdeaDateRange counts={counts} state={state} />
        <IdeaSortControl counts={counts} state={state} />
        <IdeaSavedSearches />
      </div>
    </details>
  );
}

/** ラベルを選ぶ select。一括操作と詳細ダイアログで同じ中身を使う。 */
function IdeaCardActions({ note }: { readonly note: IdeaNote }) {
  return (
    <div class="idea-card__actions">
      <button
        class="idea-card__pin"
        type="button"
        data-idea-pin
        aria-pressed={note.pinned ? "true" : "false"}
        aria-label={note.pinned ? "ピンを外す" : "ピンする"}
      >
        <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
          <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.8v6h2.4v-6H20v-2z" />
        </svg>
      </button>
    </div>
  );
}

function IdeaCardImage({ image }: { readonly image: IdeaImage | undefined }) {
  if (image === undefined) return null;
  return (
    <div class="idea-card__image-wrap">
      <img class="idea-card__image" src={`/api/images/${encodeURIComponent(image.image_id)}`} alt="" loading="lazy" />
      <button class="idea-card__image-remove" type="button" data-idea-image-remove={image.id} aria-label="画像を削除">
        ×
      </button>
    </div>
  );
}

/** カードと詳細が共有する添付チップ。画像はサムネイル、それ以外は名前とサイズ。 */
function IdeaAttachmentChip({ attachment }: { readonly attachment: IdeaAttachment }) {
  const kind = ideaAttachmentKind(attachment.content_type);
  return (
    <span
      class={`idea-attachment idea-attachment--${kind}`}
      data-idea-attachment-id={attachment.id}
      data-idea-attachment-kind={kind}
      data-idea-attachment-preview={attachment.preview}
      data-idea-attachment-type={attachment.content_type}
    >
      {kind === "image" ? (
        <img
          class="idea-attachment__thumb"
          src={`/api/attachments/${encodeURIComponent(attachment.id)}`}
          alt=""
          loading="lazy"
        />
      ) : (
        <span class="idea-attachment__icon" aria-hidden="true">
          📄
        </span>
      )}
      <span class="idea-attachment__name">{attachment.name}</span>
      <span class="idea-attachment__size">{formatIdeaAttachmentBytes(attachment.bytes)}</span>
      <button
        class="idea-attachment__remove"
        type="button"
        data-idea-attachment-remove={attachment.id}
        aria-label={`${attachment.name} を削除`}
      >
        ×
      </button>
    </span>
  );
}

function IdeaCardAttachments({ attachments }: { readonly attachments: readonly IdeaAttachment[] }) {
  return (
    <div class="idea-card__attachments" data-idea-attachment-panel>
      <span class="idea-card__attachment-drop" data-idea-attachment-drop hidden>
        ここに添付
      </span>
      <span class="idea-card__attachment-count" data-idea-attachment-count hidden={attachments.length === 0}>
        📎 {attachments.length}
      </span>
      <div class="idea-card__attachment-items" data-idea-attachment-items>
        {attachments.map((attachment) => (
          <IdeaAttachmentChip key={attachment.id} attachment={attachment} />
        ))}
      </div>
      <div class="idea-attachment__progress" data-idea-attachment-progress hidden>
        <i />
      </div>
      <p class="idea-card__attachment-status" data-idea-attachment-status hidden />
    </div>
  );
}

function ideaPreviewDomain(note: IdeaNote, url: string): string {
  if (note.preview_domain !== null && note.preview_domain !== "") return displayHostname(note.preview_domain);
  try {
    return displayHostname(new URL(url).hostname);
  } catch {
    return url;
  }
}

function hasIdeaPreview(note: IdeaNote): boolean {
  return note.preview_domain !== null || note.preview_title !== null || note.preview_image !== null;
}

/** The note body keeps the raw link; the card upgrades it to a preview once metadata exists. */
function IdeaCardPreview({ note }: { readonly note: IdeaNote }) {
  const url = extractIdeaPreviewUrl(`${note.title}\n${note.body}`);
  if (url === null) return null;
  const link = (
    <a class="idea-card__link" href={url} target="_blank" rel="noopener noreferrer nofollow" data-idea-link>
      {ideaPreviewDomain(note, url)}
    </a>
  );
  if (!hasIdeaPreview(note)) {
    return (
      <p class="idea-card__plain-link">
        <a class="idea-card__link" href={url} target="_blank" rel="noopener noreferrer nofollow" data-idea-link>
          {displayUrl(url)}
        </a>
      </p>
    );
  }
  return (
    <div class="idea-card__preview" data-idea-preview>
      {note.preview_image === null ? null : (
        <img
          class="idea-card__preview-image"
          src={note.preview_image}
          alt=""
          loading="lazy"
          decoding="async"
          referrerpolicy="no-referrer"
        />
      )}
      <div class="idea-card__preview-text">
        {link}
        {note.preview_title === null ? null : <p class="idea-card__preview-title">{note.preview_title}</p>}
        {note.preview_description === null ? null : (
          <p class="idea-card__preview-description">{note.preview_description}</p>
        )}
      </div>
    </div>
  );
}

/** 詳細ダイアログが JS で描画するため、添付はカード上の JSON にも持たせる。 */
function ideaAttachmentJson(attachments: readonly IdeaAttachment[]): string {
  return JSON.stringify(
    attachments.map((attachment) => ({
      id: attachment.id,
      name: attachment.name,
      content_type: attachment.content_type,
      bytes: attachment.bytes,
      kind: attachment.kind,
      preview: attachment.preview,
      url: `/api/attachments/${encodeURIComponent(attachment.id)}`,
    })),
  );
}

/** 本文はテキスト・リンク・画像のセグメントで描画する。貼り付けた画像もここで表示する。 */
function ideaBodySegment(segment: DescriptionSegment, index: number): JSX.Element | string {
  if (segment.src !== undefined) {
    return <img key={index} class="idea-card__image" src={segment.src} alt="" loading="lazy" decoding="async" />;
  }
  if (segment.href !== undefined) {
    return (
      <a key={index} class="idea-card__link" href={segment.href} target="_blank" rel="noopener noreferrer nofollow">
        {segment.text}
      </a>
    );
  }
  return segment.text;
}

function IdeaBody({ body }: { readonly body: string }) {
  return <p class="idea-card__body">{splitDescription(body).map(ideaBodySegment)}</p>;
}

function IdeaCard({
  note,
  images,
  attachments,
}: {
  readonly note: IdeaNote;
  readonly images: readonly IdeaImage[];
  readonly attachments: readonly IdeaAttachment[];
}) {
  return (
    <article
      class={`idea-card idea-card--${note.color}`}
      data-idea-id={note.id}
      data-idea-color={note.color}
      data-idea-pinned={note.pinned ? "true" : "false"}
      data-idea-title={note.title}
      data-idea-body={note.body}
      data-idea-images={JSON.stringify(
        images.map((image) => ({
          link: image.id,
          src: `/api/images/${encodeURIComponent(image.image_id)}`,
        })),
      )}
      data-idea-attachments={ideaAttachmentJson(attachments)}
      data-idea-open
    >
      <IdeaCardActions note={note} />
      <h2 class="idea-card__title">{note.title}</h2>
      <IdeaCardImage image={images[0]} />
      {note.body === "" ? null : <IdeaBody body={note.body} />}
      <IdeaCardPreview note={note} />
      <IdeaCardAttachments attachments={attachments} />
    </article>
  );
}

function IdeaSearch({ state }: { readonly state: IdeaState }) {
  return (
    <form class="idea-search" action="/ideas" method="get" data-idea-search>
      <input type="hidden" name="filter" value={state.filter} />
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
        data-idea-search-input
      />
      {state.query.trim() === "" ? null : (
        <a
          class="idea-search__clear"
          href={ideaListHref({ ...state, query: "" })}
          aria-label="検索を解除"
          data-idea-search-clear
        >
          ×
        </a>
      )}
    </form>
  );
}

/** Keep の「⋯」: ゴミ箱へ / 削除。 */
function IdeaDetailMoreMenu() {
  return (
    <details class="idea-detail__more">
      <summary class="idea-detail__icon" aria-label="その他">
        ⋯
      </summary>
      <div class="idea-detail__menu">
        <button type="button" data-idea-detail-archive>
          アーカイブ
        </button>
        <button type="button" data-idea-detail-trash>
          ゴミ箱へ
        </button>
        <button type="button" data-idea-detail-delete>
          削除
        </button>
      </div>
    </details>
  );
}

function IdeaDetailSwatches() {
  return (
    <div class="idea-detail__swatches" data-idea-detail-swatches hidden>
      {IDEA_COLORS.map((color) => (
        <button
          key={color}
          class={`idea-swatch idea-swatch--${color}`}
          type="button"
          data-idea-detail-color={color}
          aria-label={`${color} に変更`}
        />
      ))}
    </div>
  );
}

/** 詳細の添付一覧。中身は開いたときに JS がカードの JSON から描く。 */
function IdeaDetailAttachments() {
  return (
    <div class="idea-detail__attachments" data-idea-detail-attachments>
      <div class="idea-detail__attachment-items" data-idea-detail-attachment-items />
      <div class="idea-attachment__progress" data-idea-attachment-progress hidden>
        <i />
      </div>
      <p class="idea-detail__attachment-status" data-idea-attachment-status hidden />
    </div>
  );
}

/**
 * Keep のノート画面に合わせた詳細ダイアログ。実際の値はカードから JS が流し込む。
 */
function IdeaDetailDialog() {
  return (
    <div class="idea-detail" data-idea-detail hidden>
      <div class="idea-detail__backdrop" data-idea-detail-backdrop />
      <div
        class="idea-detail__dialog"
        data-idea-detail-dialog
        role="dialog"
        aria-modal="true"
        aria-label="メモの詳細"
      >
        <div class="idea-detail__head">
          <input
            class="idea-detail__title"
            type="text"
            maxlength={256}
            aria-label="メモのタイトル"
            data-idea-detail-title
          />
          <button
            class="idea-detail__pin"
            type="button"
            data-idea-detail-pin
            aria-pressed="false"
            aria-label="ピン"
          >
            📌
          </button>
        </div>
        <div class="idea-detail__body" data-idea-detail-scroll>
          <textarea
            class="idea-detail__text"
            rows={2}
            maxlength={16384}
            aria-label="メモの本文"
            data-idea-detail-body
          />
          <div class="idea-detail__images" data-idea-detail-images />
          <IdeaDetailAttachments />
        </div>
        <p class="idea-detail__drop" data-idea-detail-drop hidden>
          ここに添付
        </p>
        <div class="idea-detail__bar">
          <IdeaDetailMoreMenu />
          <button class="idea-detail__icon" type="button" data-idea-detail-palette aria-label="パレット">
            🎨
          </button>
          <IdeaDetailSwatches />
          <button class="idea-detail__close" type="button" data-idea-detail-close>
            閉じる
          </button>
        </div>
        <p class="idea-detail__error" data-idea-detail-error role="alert" hidden />
      </div>
    </div>
  );
}

function IdeaSnackbar() {
  return (
    <div class="idea-snackbar" data-idea-snackbar role="status" hidden>
      <span class="idea-snackbar__message" data-idea-snackbar-message></span>
    </div>
  );
}

function IdeaHeader() {
  return (
    <div class="page-header">
      <div>
        <h1 class="page-title">Ideas</h1>
      </div>
    </div>
  );
}

function IdeaGrid({
  notes,
  images,
  attachments,
}: {
  readonly notes: readonly IdeaNote[];
  readonly images: Readonly<Record<string, readonly IdeaImage[]>>;
  readonly attachments: Readonly<Record<string, readonly IdeaAttachment[]>>;
}) {
  if (notes.length === 0) {
    return (
      <p class="idea-empty" data-idea-empty>
        メモはありません。
      </p>
    );
  }
  return (
    <div class="idea-grid" data-idea-grid>
      {notes.map((note) => (
        <IdeaCard
          key={note.id}
          note={note}
          images={images[note.id] ?? []}
          attachments={attachments[note.id] ?? []}
        />
      ))}
    </div>
  );
}

export function IdeasPage({
  notes,
  counts,
  state,
  images,
  attachments,
}: {
  readonly notes: readonly IdeaNote[];
  readonly counts: IdeaNoteCounts;
  readonly state: IdeaState;
  readonly images: Readonly<Record<string, readonly IdeaImage[]>>;
  readonly attachments: Readonly<Record<string, readonly IdeaAttachment[]>>;
}) {
  return (
    <div class="page page--idea" data-idea-page data-idea-sort={state.sort ?? IDEA_DEFAULT_SORT}>
      <IdeaHeader />
      <div class="idea-layout">
        <IdeaSidebar counts={counts} state={state} />
        <section class="idea-main">
          <div class="idea-toolbar">
            <IdeaSearch state={state} />
            <IdeaFilterMenu counts={counts} state={state} />
          </div>
          <IdeaComposer />
          <IdeaGrid notes={notes} images={images} attachments={attachments} />
        </section>
      </div>
      <IdeaDetailDialog />
      <IdeaSnackbar />
    </div>
  );
}
