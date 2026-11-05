import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireAdmin } from "./access";
import { audit } from "./lib/audit";
import { IMAGE_ERROR, isValidImage } from "./lib/images";
import { assertInt, cleanText, fail } from "./lib/validate";

const DEFAULT_LOW_STOCK = 5;

export const dashboard = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const products = await ctx.db.query("products").take(1000);
    const live = products.filter((product) => !product.archived);
    const variants = await ctx.db.query("productVariants").take(2000);
    const productById = new Map(products.map((product) => [product._id, product]));

    const lowStock = variants
      .filter((variant) => {
        const product = productById.get(variant.productId);
        return (
          variant.active &&
          product &&
          product.stockManaged &&
          !product.archived &&
          variant.stockQuantity <= (variant.lowStockThreshold ?? DEFAULT_LOW_STOCK)
        );
      })
      .slice(0, 10)
      .map((variant) => ({
        variantId: variant._id,
        productName: productById.get(variant.productId)?.name ?? "",
        variantName: variant.name,
        stockQuantity: variant.stockQuantity,
      }));

    const designs = await ctx.db.query("designs").take(1000);
    const orders = await ctx.db.query("orders").order("desc").take(500);
    const approved = orders.filter((order) => order.paymentStatus === "approved");

    return {
      products: { total: live.length, published: live.filter((product) => product.active).length },
      designs: {
        total: designs.filter((design) => !design.archived).length,
        published: designs.filter((design) => design.active && !design.archived).length,
      },
      orders: {
        total: orders.length,
        pendingPayment: orders.filter((order) => order.paymentStatus === "pending").length,
        approved: approved.length,
        revenueCents: approved.reduce((sum, order) => sum + order.totalCents, 0),
      },
      lowStock,
    };
  },
});

/* --------------------------------- Images --------------------------------- */

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Vérifie un fichier envoyé (type et taille côté serveur). Un fichier invalide est supprimé. */
export const registerUploadedImage = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (!(await isValidImage(ctx, args.storageId))) {
      await ctx.storage.delete(args.storageId);
      return { ok: false as const, error: IMAGE_ERROR };
    }
    const url = await ctx.storage.getUrl(args.storageId);
    return url ? { ok: true as const, url } : { ok: false as const, error: IMAGE_ERROR };
  },
});

/* ---------------------------------- Stock --------------------------------- */

export const listStock = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const products = (await ctx.db.query("products").take(500)).filter((product) => !product.archived);
    const rows = [];
    for (const product of products) {
      const variants = await ctx.db
        .query("productVariants")
        .withIndex("by_product", (q) => q.eq("productId", product._id))
        .collect();
      for (const variant of variants) {
        rows.push({
          variantId: variant._id,
          productId: product._id,
          productName: product.name,
          variantName: variant.name,
          sku: variant.sku ?? null,
          stockQuantity: variant.stockQuantity,
          lowStockThreshold: variant.lowStockThreshold ?? DEFAULT_LOW_STOCK,
          active: variant.active,
          stockManaged: product.stockManaged,
        });
      }
    }
    return rows;
  },
});

export const setVariantStock = mutation({
  args: { variantId: v.id("productVariants"), newQuantity: v.number(), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    assertInt(args.newQuantity, "Estoque", 0, 1_000_000);
    const variant = await ctx.db.get(args.variantId);
    if (!variant) fail("Opção não encontrada.");
    const reason = args.reason ? cleanText(args.reason, "Motivo", 200, false) : "";
    const delta = args.newQuantity - variant.stockQuantity;
    if (delta === 0) return;
    await ctx.db.patch(variant._id, { stockQuantity: args.newQuantity });
    await ctx.db.insert("inventoryMovements", {
      productId: variant.productId,
      variantId: variant._id,
      quantityDelta: delta,
      reason: reason || "Ajuste manual",
      source: "admin",
      createdBy: admin._id,
      createdAt: Date.now(),
    });
    await audit(ctx, admin._id, "stock.adjust", "variant", variant._id, { delta });
  },
});

/* --------------------------------- Rôles ---------------------------------- */

/**
 * Attribution d'un rôle depuis la ligne de commande (fonction interne, non appelable depuis le navigateur) :
 *   npx convex run admin:setUserRole '{"email":"vous@exemple.com","role":"super_admin"}' --prod
 * Le compte doit déjà exister (inscription sur le site).
 */
export const setUserRole = internalMutation({
  args: {
    email: v.string(),
    role: v.union(v.literal("super_admin"), v.literal("admin"), v.literal("customer"), v.literal("affiliate")),
  },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();
    if (!user) return `Usuário não encontrado: ${email}. Crie a conta no site primeiro.`;
    await ctx.db.patch(user._id, { role: args.role, updatedAt: Date.now() });
    await audit(ctx, user._id, "user.setRole", "user", user._id, { role: args.role });
    return `Função de ${email} definida como ${args.role}.`;
  },
});
