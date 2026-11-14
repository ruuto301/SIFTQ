import type { Context, Hono } from "hono";
import type { JSX } from "hono/jsx/jsx-runtime";
import { Layout } from "../components/Layout";
import { MkPage } from "../views/MkPage";
import type { MkNoteCounts } from "../views/MkPage";
import { filterMkNotes, isMkColor, isMkFilter, sortMkNotes } from "../mk";
import type { MkColor, MkFilter, MkNote, MkNoteQuery } from "../mk";
import type { AppEnv } from "../app-env";
import type { MkRepository } from "../repository/mk-repository";

const OWNER_ID = "local";

type Repository = (c: Context<AppEnv>) => MkRepository;

function renderMkPage(c: Context<AppEnv>, content: JSX.Element) {
  if (c.req.header("HX-Request")) return c.html(content);
  return c.html(<Layout active="mk">{content}</Layout>);
}

function readFilter(value: unknown): MkFilter {
  return isMkFilter(value) ? value : "all";
}

function readColor(value: unknown): MkColor | undefined {
  return isMkColor(value) ? value : undefined;
}

function countMkNotes(notes: readonly MkNote[]): MkNoteCounts {
  return {
    all: notes.length,
    pinned: notes.filter((note) => note.pinned).length,
    unpinned: notes.filter((note) => !note.pinned).length,
  };
}

function listQuery(filter: MkFilter, color: MkColor | undefined, text: string): MkNoteQuery {
  return {
    filter,
    ...(color === undefined ? {} : { color }),
    ...(text === "" ? {} : { text }),
  };
}

export function registerMkScreenRoutes(app: Hono<AppEnv>, repository: Repository) {
  app.get("/mk", async (c) => {
    const result = await repository(c).list(OWNER_ID);
    if (!result.ok) return c.text("Internal Server Error", 500);
    const filter = readFilter(c.req.query("filter"));
    const color = readColor(c.req.query("color"));
    const query = c.req.query("q") ?? "";
    const notes = sortMkNotes(filterMkNotes(result.value, listQuery(filter, color, query.trim())));
    return renderMkPage(
      c,
      <MkPage notes={notes} counts={countMkNotes(result.value)} filter={filter} query={query} color={color} />,
    );
  });
}
