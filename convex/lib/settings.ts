import type { MutationCtx, QueryCtx } from "../_generated/server";
import { DEFAULT_SHIPPING_MARKUP_CENTS } from "../../shared/shipping";

// Paramètres NON sensibles uniquement. Les secrets vivent dans les variables Convex.

export const DEFAULT_STORE = { storeName: "", contactEmail: "", whatsapp: "", instagram: "", address: "" };
export const DEFAULT_SHIPPING = {
  originCep: "",
  markupCents: DEFAULT_SHIPPING_MARKUP_CENTS,
  enablePac: true,
  enableSedex: true,
};

export async function readSetting<T extends object>(
  ctx: QueryCtx | MutationCtx,
  key: string,
  defaults: T,
): Promise<T> {
  const row = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  return { ...defaults, ...(row?.value as Partial<T> | undefined) };
}
