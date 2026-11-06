import { v } from "convex/values";
import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { activeVariants, imageUrls, priceCartLines } from "./lib/cart";
import { unitPriceCents } from "../shared/pricing";

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function variantInStock(product: Doc<"products">, variant: Doc<"productVariants">): boolean {
  return !product.stockManaged || variant.stockQuantity > 0;
}

export const listCategories = query({
  args: {},
  handler: async (ctx) => {
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_active_sort", (q) => q.eq("active", true))
      .collect();
    return Promise.all(
      categories.map(async (category) => ({
        _id: category._id,
        name: category.name,
        slug: category.slug,
        description: category.description ?? null,
        imageUrl: category.imageStorageId
          ? await ctx.storage.getUrl(category.imageStorageId)
          : null,
      })),
    );
  },
});

async function toCard(ctx: QueryCtx, product: Doc<"products">) {
  const variants = await activeVariants(ctx, product._id);
  const fromPriceCents =
    variants.length > 0
      ? Math.min(
          ...variants.map((variant) =>
            unitPriceCents({
              basePriceCents: product.basePriceCents,
              variantAdjustmentCents: variant.priceAdjustmentCents,
            }),
          ),
        )
      : product.basePriceCents;
  const [firstImage] = await imageUrls(ctx, product.imageStorageIds.slice(0, 1));
  return {
    _id: product._id,
    name: product.name,
    slug: product.slug,
    shortDescription: product.shortDescription ?? null,
    featured: product.featured,
    fromPriceCents,
    imageUrl: firstImage ?? null,
    isDemo: product.isDemo ?? false,
    createdAt: product.createdAt,
  };
}

export const listProducts = query({
  args: {
    categorySlug: v.optional(v.string()),
    search: v.optional(v.string()),
    sort: v.optional(
      v.union(v.literal("novidades"), v.literal("menor_preco"), v.literal("maior_preco")),
    ),
  },
  handler: async (ctx, args) => {
    let products = (
      await ctx.db
        .query("products")
        .withIndex("by_active", (q) => q.eq("active", true))
        .take(300)
    ).filter((product) => !product.archived);

    if (args.categorySlug) {
      const category = await ctx.db
        .query("categories")
        .withIndex("by_slug", (q) => q.eq("slug", args.categorySlug!))
        .unique();
      if (!category || !category.active) return [];
      products = products.filter((product) => product.categoryIds.includes(category._id));
    }

    const term = args.search ? normalize(args.search.trim()) : "";
    if (term) products = products.filter((product) => normalize(product.name).includes(term));

    const cards = await Promise.all(products.map((product) => toCard(ctx, product)));
    switch (args.sort ?? "novidades") {
      case "menor_preco":
        return cards.sort((a, b) => a.fromPriceCents - b.fromPriceCents);
      case "maior_preco":
        return cards.sort((a, b) => b.fromPriceCents - a.fromPriceCents);
      default:
        return cards.sort((a, b) => b.createdAt - a.createdAt);
    }
  },
});

export const featuredProducts = query({
  args: {},
  handler: async (ctx) => {
    const products = await ctx.db
      .query("products")
      .withIndex("by_active_featured", (q) => q.eq("active", true).eq("featured", true))
      .take(6);
    return Promise.all(products.filter((p) => !p.archived).map((p) => toCard(ctx, p)));
  },
});

export const getProduct = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const product = await ctx.db
      .query("products")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!product || !product.active || product.archived) return null;

    const variants = await activeVariants(ctx, product._id);
    const designs = (
      await ctx.db
        .query("designs")
        .withIndex("by_active_sort", (q) => q.eq("active", true))
        .collect()
    ).filter((design) => !design.archived && design.compatibleProductIds.includes(product._id));

    return {
      product: {
        _id: product._id,
        name: product.name,
        slug: product.slug,
        shortDescription: product.shortDescription ?? null,
        description: product.description ?? null,
        basePriceCents: product.basePriceCents,
        imageUrls: await imageUrls(ctx, product.imageStorageIds),
        isDemo: product.isDemo ?? false,
      },
      variants: variants.map((variant) => ({
        _id: variant._id,
        name: variant.name,
        options: variant.options,
        priceAdjustmentCents: variant.priceAdjustmentCents,
        inStock: variantInStock(product, variant),
      })),
      designs: await Promise.all(
        designs.map(async (design) => ({
          _id: design._id,
          name: design.name,
          description: design.description ?? null,
          imageUrls: await imageUrls(ctx, design.imageStorageIds),
          priceAdjustmentCents: design.priceAdjustmentCents,
          supportedTechnologies: design.supportedTechnologies,
          compatibleVariantIds: (design.compatibleVariantIds ?? []).map(String),
        })),
      ),
    };
  },
});

/**
 * Recalcule le panier côté serveur : le frontend n'envoie que des identifiants et des quantités,
 * jamais de prix. Les lignes invalides sont signalées et exclues du sous-total.
 */
export const priceCart = query({
  args: {
    items: v.array(
      v.object({
        productId: v.string(),
        variantId: v.optional(v.string()),
        designId: v.optional(v.string()),
        quantity: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { lines, subtotalCents } = await priceCartLines(ctx, args.items, { withImages: true });
    return {
      lines: lines.map((line) => {
        const { physical, ...publicLine } = line;
        void physical; // poids/dimensions : usage interne (frete), jamais renvoyés au navigateur
        return publicLine;
      }),
      subtotalCents,
    };
  },
});
