import type { Context, Hono } from "hono";
import type { JSX } from "hono/jsx/jsx-runtime";
import { Layout } from "../components/Layout";
import { MkPage } from "../views/MkPage";
import type { MkState } from "../views/MkPage";
import { isMkColor, isMkDateKind, isMkFilter, normalizeMkDateBound, parseMkSort, sortMkNotesByQuery } from "../mk";
import type {
  MkColor,
  MkDateKind,
  MkFilter,
  MkImage,
  MkNote,
  MkNoteLabelMap,
  MkNoteQuery,
  MkSort,
} from "../mk";
import type { AppEnv } from "../app-env";
import type { MkRepository } from "../repository/mk-repository";

const OWNER_ID = "local";

type Repository = (c: Context<AppEnv>) => MkRepository;

function renderMkPage(c: Context<AppEnv>, content: JSX.Element) {
  if (c.req.header("HX-Request")) return c.html(content);
  return c.html(<Layout active="mk">{content}</Layout>);
}

/** `all` stays accepted as the legacy alias of the default notes view. */
function readFilter(value: unknown): MkFilter {
  if (value === "all") return "notes";
  return isMkFilter(value) ? value : "notes";
}

function readColor(value: unknown): MkColor | undefined {
  return isMkColor(value) ? value : undefined;
}

function readDateKind(value: unknown): MkDateKind | undefined {
  return isMkDateKind(value) ? value : undefined;
}

/** A malformed date simply drops the bound; the API returns a 400 for the same input. */
function readDateBound(c: Context<AppEnv>, name: string, dateName: string, endOfDay: boolean): string | undefined {
  const value = c.req.query(name) || c.req.query(dateName) || "";
  if (value === "") return undefined;
  return normalizeMkDateBound(value, endOfDay) ?? undefined;
}

function readSort(value: unknown): MkSort | undefined {
  return parseMkSort(value) ?? undefined;
}

function listQuery(state: MkState): MkNoteQuery {
  const text = state.query.trim();
  return {
    filter: state.filter,
    ...(state.color === undefined ? {} : { color: state.color }),
    ...(text === "" ? {} : { text }),
    ...(state.labelId === "" ? {} : { labelId: state.labelId }),
    ...(state.dateKind === undefined || (state.from === undefined && state.to === undefined)
      ? {}
      : { dateKind: state.dateKind }),
    ...(state.from === undefined ? {} : { from: state.from }),
    ...(state.to === undefined ? {} : { to: state.to }),
    ...(state.sort === undefined ? {} : { sort: state.sort }),
  };
}

/** Loads the attached images for the rendered notes, keyed by note id. */
async function imagesByNote(
  repository: MkRepository,
  notes: readonly MkNote[],
): Promise<Record<string, readonly MkImage[]>> {
  const entries = await Promise.all(
    notes.map(async (note): Promise<readonly [string, readonly MkImage[]]> => {
      const result = await repository.listImages(note.id, OWNER_ID);
      return [note.id, result.ok ? result.value : []];
    }),
  );
  return Object.fromEntries(entries);
}

/** One batch query for every rendered note keeps the page free of per-note label queries. */
async function labelsForNotes(
  repository: MkRepository,
  notes: readonly MkNote[],
): Promise<MkNoteLabelMap> {
  const result = await repository.listLabelsForNotes(
    notes.map((note) => note.id),
    OWNER_ID,
  );
  return result.ok ? result.value : {};
}

export function registerMkScreenRoutes(app: Hono<AppEnv>, repository: Repository) {
  app.get("/mk", async (c) => {
    const repositoryForRequest = repository(c);
    const filter = readFilter(c.req.query("filter"));
    const color = readColor(c.req.query("color"));
    const labelId = c.req.query("label") ?? "";
    const query = c.req.query("q") ?? "";
    const dateKind = readDateKind(c.req.query("dateKind"));
    const from = readDateBound(c, "from", "fromDate", false);
    const to = readDateBound(c, "to", "toDate", true);
    const sort = readSort(c.req.query("sort"));
    const state: MkState = { filter, labelId, query, color, dateKind, from, to, sort };
    const [listed, counts, labels] = await Promise.all([
      repositoryForRequest.list(OWNER_ID, listQuery(state)),
      repositoryForRequest.counts(OWNER_ID),
      repositoryForRequest.listLabels(OWNER_ID),
    ]);
    if (!listed.ok || !counts.ok || !labels.ok) return c.text("Internal Server Error", 500);
    const notes = sortMkNotesByQuery(listed.value, sort);
    const [images, labelsByNote] = await Promise.all([
      imagesByNote(repositoryForRequest, notes),
      labelsForNotes(repositoryForRequest, notes),
    ]);
    return renderMkPage(
      c,
      <MkPage
        notes={notes}
        counts={counts.value}
        labels={labels.value}
        labelsByNote={labelsByNote}
        state={state}
        images={images}
      />,
    );
  });
}
