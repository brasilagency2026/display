import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { fail } from "./validate";

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_ERROR = "Imagem inválida. Use JPG, PNG, WebP ou AVIF de até 5 MB.";

export async function isValidImage(ctx: MutationCtx, id: Id<"_storage">): Promise<boolean> {
  const meta = await ctx.db.system.get(id);
  return (
    meta !== null &&
    meta.contentType !== undefined &&
    ALLOWED_IMAGE_TYPES.includes(meta.contentType) &&
    meta.size <= MAX_IMAGE_BYTES
  );
}

/**
 * Valide les nouvelles images (type et taille vérifiés côté serveur) et supprime celles retirées.
 * Appelé à chaque sauvegarde pour ne jamais faire confiance au navigateur.
 */
export async function syncImages(
  ctx: MutationCtx,
  previous: Id<"_storage">[],
  next: Id<"_storage">[],
): Promise<void> {
  for (const id of next) {
    if (!previous.includes(id) && !(await isValidImage(ctx, id))) fail(IMAGE_ERROR);
  }
  for (const id of previous) {
    if (!next.includes(id)) await ctx.storage.delete(id);
  }
}
