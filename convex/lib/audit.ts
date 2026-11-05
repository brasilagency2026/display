import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/** Journal d'audit. Ne jamais y mettre de secret ni de donnée personnelle. */
export async function audit(
  ctx: MutationCtx,
  actorUserId: Id<"users">,
  action: string,
  entityType: string,
  entityId?: string,
  metadata?: Record<string, string | number | boolean | null>,
) {
  await ctx.db.insert("auditLogs", {
    actorUserId,
    action,
    entityType,
    entityId,
    metadata,
    createdAt: Date.now(),
  });
}
