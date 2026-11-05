import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireAdmin } from "./access";
import { audit } from "./lib/audit";
import { assertInt, cleanText, fail, optionalText } from "./lib/validate";
import { DEFAULT_SHIPPING_MARKUP_CENTS } from "../shared/shipping";

// Paramètres NON sensibles uniquement. Les secrets (Mercado Pago, Melhor Envio…) vivent dans les variables Convex.

const DEFAULT_STORE = { storeName: "", contactEmail: "", whatsapp: "", instagram: "", address: "" };
const DEFAULT_SHIPPING = {
  originCep: "",
  markupCents: DEFAULT_SHIPPING_MARKUP_CENTS,
  enablePac: true,
  enableSedex: true,
};

async function readSetting<T extends object>(ctx: QueryCtx | MutationCtx, key: string, defaults: T): Promise<T> {
  const row = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  return { ...defaults, ...(row?.value as Partial<T> | undefined) };
}

async function writeSetting(ctx: MutationCtx, key: string, value: object) {
  const row = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  if (row) await ctx.db.patch(row._id, { value, updatedAt: Date.now() });
  else await ctx.db.insert("settings", { key, value, updatedAt: Date.now() });
}

/** Informations publiques de la boutique (nom, contacts). */
export const getStore = query({
  args: {},
  handler: async (ctx) => readSetting(ctx, "store", DEFAULT_STORE),
});

export const getAdminSettings = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return {
      store: await readSetting(ctx, "store", DEFAULT_STORE),
      shipping: await readSetting(ctx, "shipping", DEFAULT_SHIPPING),
    };
  },
});

export const saveStore = mutation({
  args: {
    storeName: v.string(),
    contactEmail: v.string(),
    whatsapp: v.string(),
    instagram: v.string(),
    address: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const contactEmail = cleanText(args.contactEmail, "E-mail", 120, false);
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) fail("E-mail de contato inválido.");
    const whatsapp = args.whatsapp.replace(/\D/g, "");
    if (whatsapp && (whatsapp.length < 10 || whatsapp.length > 15)) {
      fail("WhatsApp: informe o número com DDI e DDD, por exemplo 5511999999999.");
    }
    await writeSetting(ctx, "store", {
      storeName: cleanText(args.storeName, "Nome da loja", 80, false),
      contactEmail,
      whatsapp,
      instagram: optionalText(args.instagram, "Instagram", 120) ?? "",
      address: optionalText(args.address, "Endereço", 300) ?? "",
    });
    await audit(ctx, admin._id, "settings.store", "settings", "store");
  },
});

export const saveShipping = mutation({
  args: {
    originCep: v.string(),
    markupCents: v.number(),
    enablePac: v.boolean(),
    enableSedex: v.boolean(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const originCep = args.originCep.replace(/\D/g, "");
    if (originCep && originCep.length !== 8) fail("CEP de origem inválido: use 8 dígitos.");
    assertInt(args.markupCents, "Acréscimo no frete", 0, 100_000);
    await writeSetting(ctx, "shipping", {
      originCep,
      markupCents: args.markupCents,
      enablePac: args.enablePac,
      enableSedex: args.enableSedex,
    });
    await audit(ctx, admin._id, "settings.shipping", "settings", "shipping", { markupCents: args.markupCents });
  },
});
