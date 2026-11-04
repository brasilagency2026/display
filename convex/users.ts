import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";

/** Utilisateur connecté (ou null). N'expose que les champs nécessaires à l'interface. */
export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return {
      _id: user._id,
      name: user.name ?? null,
      email: user.email ?? null,
      role: user.role ?? "customer",
    };
  },
});
