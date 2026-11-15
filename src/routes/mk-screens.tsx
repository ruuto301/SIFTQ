import type { Context, Hono } from "hono";
import type { JSX } from "hono/jsx/jsx-runtime";
import { Layout } from "../components/Layout";
import { MkPage } from "../views/MkPage";
import { isMkColor, isMkFilter, sortMkNotes } from "../mk";
import type { MkColor, MkFilter, MkImage, MkNote, MkNoteLabelMap, MkNoteQuery } from "../mk";
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

function listQuery(filter: MkFilter, color: MkColor | undefined, text: string, labelId: string): MkNoteQuery {
  return {
    filter,
    ...(color === undefined ? {} : { color }),
    ...(text === "" ? {} : { text }),
    ...(labelId === "" ? {} : { labelId }),
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
    const [listed, counts, labels] = await Promise.all([
      repositoryForRequest.list(OWNER_ID, listQuery(filter, color, query.trim(), labelId)),
      repositoryForRequest.counts(OWNER_ID),
      repositoryForRequest.listLabels(OWNER_ID),
    ]);
    if (!listed.ok || !counts.ok || !labels.ok) return c.text("Internal Server Error", 500);
    const notes = sortMkNotes(listed.value);
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
        filter={filter}
        labelId={labelId}
        query={query}
        color={color}
        images={images}
      />,
    );
  });
}
