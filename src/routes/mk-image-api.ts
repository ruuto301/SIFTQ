import type { Context, Hono } from "hono";
import { MK_MAX_IMAGES, createMkImage, isMkRecord } from "../mk";
import type { MkImage } from "../mk";
import { errorStatus, findOwned, problem, readJsonRecord } from "./api-helpers";
import type { AppEnv } from "../app-env";
import type { ImageRepository } from "../repository/image-repository";
import type { MkRepository } from "../repository/mk-repository";

const OWNER_ID = "local";

type MkRepositoryFactory = (c: Context<AppEnv>) => MkRepository;
type ImageRepositoryFactory = (c: Context<AppEnv>) => ImageRepository;

/** Positions are 1-based, so the next slot follows the highest attached image even after removals. */
function nextImagePosition(images: readonly MkImage[]): number {
  return images.reduce((highest, image) => Math.max(highest, image.position), 0) + 1;
}

async function linkNoteImage(
  c: Context<AppEnv>,
  mkRepository: MkRepositoryFactory,
  imageRepository: ImageRepositoryFactory,
) {
  const noteId = c.req.param("id");
  if (noteId === undefined) return problem(c, 404, "NOT_FOUND");
  const body = await readJsonRecord(c, isMkRecord);
  if (body === null) return problem(c, 400, "INVALID_INPUT");
  const imageId = body["imageId"];
  if (typeof imageId !== "string" || imageId === "") return problem(c, 400, "INVALID_IMAGE");

  const repository = mkRepository(c);
  const note = await findOwned(repository.find(noteId, OWNER_ID), { code: "NOT_FOUND" });
  if (!note.ok) return problem(c, errorStatus(note.error.code), note.error.code);

  const image = await imageRepository(c).find(imageId, OWNER_ID);
  if (!image.ok) return problem(c, 500, image.error.code);
  if (image.value === undefined) return problem(c, 400, "INVALID_IMAGE");

  const count = await repository.countImages(noteId, OWNER_ID);
  if (!count.ok) return problem(c, 500, count.error.code);
  if (count.value >= MK_MAX_IMAGES) return problem(c, 400, "IMAGE_LIMIT_EXCEEDED");

  const attached = await repository.listImages(noteId, OWNER_ID);
  if (!attached.ok) return problem(c, 500, attached.error.code);
  const created = createMkImage({
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

async function unlinkNoteImage(c: Context<AppEnv>, mkRepository: MkRepositoryFactory) {
  const id = c.req.param("id");
  if (id === undefined) return problem(c, 404, "NOT_FOUND");
  // Unlinking drops only the note link; the uploaded blob stays in the image repository.
  const removed = await mkRepository(c).removeImage(id, OWNER_ID);
  if (!removed.ok) return problem(c, errorStatus(removed.error.code), removed.error.code);
  return c.body(null, 204);
}

export function registerMkImageApiRoutes(
  app: Hono<AppEnv>,
  mkRepository: MkRepositoryFactory,
  imageRepository: ImageRepositoryFactory,
) {
  app.post("/api/mk/notes/:id/images", (c) => linkNoteImage(c, mkRepository, imageRepository));
  app.delete("/api/mk/images/:id", (c) => unlinkNoteImage(c, mkRepository));
}
