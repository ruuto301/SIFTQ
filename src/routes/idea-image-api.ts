import type { Context, Hono } from "hono";
import { IDEA_MAX_IMAGES, createIdeaImage, isIdeaRecord } from "../idea";
import type { IdeaImage } from "../idea";
import { errorStatus, findOwned, problem, readJsonRecord, respondRemoved } from "./api-helpers";
import type { AppEnv } from "../app-env";
import type { ImageRepository } from "../repository/image-repository";
import type { IdeaRepository } from "../repository/idea-repository";

const OWNER_ID = "local";

type IdeaRepositoryFactory = (c: Context<AppEnv>) => IdeaRepository;
type ImageRepositoryFactory = (c: Context<AppEnv>) => ImageRepository;

/** Positions are 1-based, so the next slot follows the highest attached image even after removals. */
function nextImagePosition(images: readonly IdeaImage[]): number {
  return images.reduce((highest, image) => Math.max(highest, image.position), 0) + 1;
}

async function linkNoteImage(
  c: Context<AppEnv>,
  ideaRepository: IdeaRepositoryFactory,
  imageRepository: ImageRepositoryFactory,
) {
  const noteId = c.req.param("id");
  if (noteId === undefined) return problem(c, 404, "NOT_FOUND");
  const body = await readJsonRecord(c, isIdeaRecord);
  if (body === null) return problem(c, 400, "INVALID_INPUT");
  const imageId = body["imageId"];
  if (typeof imageId !== "string" || imageId === "") return problem(c, 400, "INVALID_IMAGE");

  const repository = ideaRepository(c);
  const note = await findOwned(repository.find(noteId, OWNER_ID), { code: "NOT_FOUND" });
  if (!note.ok) return problem(c, errorStatus(note.error.code), note.error.code);

  const image = await imageRepository(c).find(imageId, OWNER_ID);
  if (!image.ok) return problem(c, 500, image.error.code);
  if (image.value === undefined) return problem(c, 400, "INVALID_IMAGE");

  const count = await repository.countImages(noteId, OWNER_ID);
  if (!count.ok) return problem(c, 500, count.error.code);
  if (count.value >= IDEA_MAX_IMAGES) return problem(c, 400, "IMAGE_LIMIT_EXCEEDED");

  const attached = await repository.listImages(noteId, OWNER_ID);
  if (!attached.ok) return problem(c, 500, attached.error.code);
  const created = createIdeaImage({
    id: crypto.randomUUID(),
    note_id: noteId,
    owner_id: OWNER_ID,
    image_id: imageId,
    position: nextImagePosition(attached.value),
    created_at: new Date().toISOString(),
  });
  if (!created.ok) return problem(c, 400, created.error.code);

  const inserted = await repository.insertImage(created.value);
  if (!inserted.ok) return problem(c, 500, inserted.error.code);
  return c.json({ id: inserted.value.id, url: `/api/images/${inserted.value.image_id}` }, 201);
}

async function unlinkNoteImage(c: Context<AppEnv>, ideaRepository: IdeaRepositoryFactory) {
  const id = c.req.param("id");
  if (id === undefined) return problem(c, 404, "NOT_FOUND");
  // Unlinking drops only the note link; the uploaded blob stays in the image repository.
  return respondRemoved(c, ideaRepository(c).removeImage(id, OWNER_ID));
}

export function registerIdeaImageApiRoutes(
  app: Hono<AppEnv>,
  ideaRepository: IdeaRepositoryFactory,
  imageRepository: ImageRepositoryFactory,
) {
  app.post("/api/ideas/notes/:id/images", (c) => linkNoteImage(c, ideaRepository, imageRepository));
  app.delete("/api/ideas/images/:id", (c) => unlinkNoteImage(c, ideaRepository));
}
