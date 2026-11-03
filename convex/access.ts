import { getAuthUserId } from "@convex-dev/auth/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";

type Ctx = QueryCtx | MutationCtx;
export type Role = "super_admin" | "admin" | "customer" | "affiliate";

/** Contrôle d'accès centralisé côté backend : toute fonction admin doit appeler requireAdmin. */
export async function requireUser(ctx: Ctx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Não autenticado.");
  const user = await ctx.db.get(userId);
  if (!user || user.status === "blocked") throw new Error("Acesso negado.");
  return user;
}

export async function requireAdmin(ctx: Ctx) {
  const user = await requireUser(ctx);
  if (user.role !== "admin" && user.role !== "super_admin") {
    throw new Error("Acesso negado.");
  }
  return user;
}

export async function requireSuperAdmin(ctx: Ctx) {
  const user = await requireUser(ctx);
  if (user.role !== "super_admin") throw new Error("Acesso negado.");
  return user;
}
