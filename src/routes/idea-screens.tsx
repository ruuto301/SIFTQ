import type { Context, Hono } from "hono";
import type { JSX } from "hono/jsx/jsx-runtime";
import { Layout } from "../components/Layout";
import { IdeasPage } from "../views/IdeasPage";
import type { IdeaState } from "../views/IdeasPage";
import { isIdeaColor, isIdeaDateKind, isIdeaFilter, parseIdeaSort, sortIdeaNotesByQuery } from "../idea";
import { normalizeIdeaDateBound } from "../idea-query";
import { ideaAttachmentsOutsideBody } from "../idea-attachment";
import type { IdeaAttachment } from "../idea-attachment";
import type {
  IdeaColor,
  IdeaDateKind,
  IdeaFilter,
  IdeaNote,
  IdeaNoteQuery,
  IdeaSort,
} from "../idea";
import type { AppEnv } from "../app-env";
import type { IdeaRepository, IdeaRepositoryError } from "../repository/idea-repository";
import type { Result } from "../task";

const OWNER_ID = "local";

type Repository = (c: Context<AppEnv>) => IdeaRepository;

function renderIdeaPage(c: Context<AppEnv>, content: JSX.Element) {
  if (c.req.header("HX-Request")) return c.html(content);
  return c.html(<Layout active="ideas">{content}</Layout>);
}

/** `all` stays accepted as the legacy alias of the default notes view. */
function readFilter(value: unknown): IdeaFilter {
  if (value === "all") return "notes";
  return isIdeaFilter(value) ? value : "notes";
}

function readColor(value: unknown): IdeaColor | undefined {
  return isIdeaColor(value) ? value : undefined;
}

function readDateKind(value: unknown): IdeaDateKind | undefined {
  return isIdeaDateKind(value) ? value : undefined;
}

/** A malformed date simply drops the bound; the API returns a 400 for the same input. */
function readDateBound(c: Context<AppEnv>, name: string, dateName: string, endOfDay: boolean): string | undefined {
  const value = c.req.query(name) || c.req.query(dateName) || "";
  if (value === "") return undefined;
  return normalizeIdeaDateBound(value, endOfDay) ?? undefined;
}

function readSort(value: unknown): IdeaSort | undefined {
  return parseIdeaSort(value) ?? undefined;
}

function listQuery(state: IdeaState): IdeaNoteQuery {
  const text = state.query.trim();
  return {
    filter: state.filter,
    ...(state.color === undefined ? {} : { color: state.color }),
    ...(text === "" ? {} : { text }),
    ...(state.dateKind === undefined || (state.from === undefined && state.to === undefined)
      ? {}
      : { dateKind: state.dateKind }),
    ...(state.from === undefined ? {} : { from: state.from }),
    ...(state.to === undefined ? {} : { to: state.to }),
    ...(state.sort === undefined ? {} : { sort: state.sort }),
  };
}

/** Loads a per-note list (images or attachments) for the rendered notes, keyed by note id. */
async function groupByNote<T>(
  notes: readonly IdeaNote[],
  load: (note: IdeaNote) => Promise<Result<readonly T[], IdeaRepositoryError>>,
): Promise<Record<string, readonly T[]>> {
  const entries = await Promise.all(
    notes.map(async (note): Promise<readonly [string, readonly T[]]> => {
      const result = await load(note);
      return [note.id, result.ok ? result.value : []];
    }),
  );
  return Object.fromEntries(entries);
}

export function registerIdeaScreenRoutes(app: Hono<AppEnv>, repository: Repository) {
  app.get("/ideas", async (c) => {
    const repositoryForRequest = repository(c);
    const filter = readFilter(c.req.query("filter"));
    const color = readColor(c.req.query("color"));
    const query = c.req.query("q") ?? "";
    const dateKind = readDateKind(c.req.query("dateKind"));
    const from = readDateBound(c, "from", "fromDate", false);
    const to = readDateBound(c, "to", "toDate", true);
    const sort = readSort(c.req.query("sort"));
    const state: IdeaState = { filter, query, color, dateKind, from, to, sort };
    const [listed, counts] = await Promise.all([
      repositoryForRequest.list(OWNER_ID, listQuery(state)),
      repositoryForRequest.counts(OWNER_ID),
    ]);
    if (!listed.ok || !counts.ok) return c.text("Internal Server Error", 500);
    const notes = sortIdeaNotesByQuery(listed.value, sort);
    const [images, storedAttachments] = await Promise.all([
      groupByNote(notes, (note) => repositoryForRequest.listImages(note.id, OWNER_ID)),
      groupByNote(notes, (note) => repositoryForRequest.listAttachments(note.id, OWNER_ID)),
    ]);
    // 本文が参照する添付はインライン画像として描くので、添付欄には出さない。
    const attachments: Record<string, readonly IdeaAttachment[]> = Object.fromEntries(
      notes.map((note): [string, readonly IdeaAttachment[]] => [
        note.id,
        ideaAttachmentsOutsideBody(note.body, storedAttachments[note.id] ?? []),
      ]),
    );
    return renderIdeaPage(
      c,
      <IdeasPage
        notes={notes}
        counts={counts.value}
        state={state}
        images={images}
        attachments={attachments}
      />,
    );
  });
}
