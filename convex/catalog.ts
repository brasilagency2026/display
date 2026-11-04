import { v } from "convex/values";
import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  isDesignCompatible,
  isValidQuantity,
  lineTotalCents,
  unitPriceCents,
} from "../shared/pricing";

async function imageUrls(ctx: QueryCtx, ids: Id<"_storage">[]): Promise<string[]> {
  const urls = await Promise.all(ids.map((id) => ctx.storage.getUrl(id)));
  return urls.filter((u): u is string => u !== null);
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

async function activeVariants(ctx: QueryCtx, productId: Id<"products">) {
  const variants = await ctx.db
    .query("productVariants")
    .withIndex("by_product", (q) => q.eq("productId", productId))
    .collect();
  return variants.filter((variant) => variant.active);
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

const MAX_CART_LINES = 50;

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
    const items = args.items.slice(0, MAX_CART_LINES);
    const lines = [];
    let subtotalCents = 0;

    for (const item of items) {
      const productId = ctx.db.normalizeId("products", item.productId);
      const variantId = item.variantId ? ctx.db.normalizeId("productVariants", item.variantId) : null;
      const designId = item.designId ? ctx.db.normalizeId("designs", item.designId) : null;
      const base = {
        productId: item.productId,
        variantId: item.variantId ?? null,
        designId: item.designId ?? null,
        quantity: item.quantity,
      };
      const invalid = (problem: string) => ({
        ...base,
        name: "Produto indisponível",
        variantName: null,
        designName: null,
        imageUrl: null,
        unitPriceCents: 0,
        lineTotalCents: 0,
        problem,
      });

      const product = productId ? await ctx.db.get(productId) : null;
      if (!product || !product.active || product.archived) {
        lines.push(invalid("Este produto não está mais disponível."));
        continue;
      }
      if (!isValidQuantity(item.quantity)) {
        lines.push({ ...invalid("Quantidade inválida."), name: product.name });
        continue;
      }

      const variants = await activeVariants(ctx, product._id);
      const variant = variantId ? (variants.find((candidate) => candidate._id === variantId) ?? null) : null;
      let problem: string | null = null;

      if (variants.length > 0 && !variant) problem = "Escolha uma opção válida para este produto.";
      if (!problem && variant && product.stockManaged && variant.stockQuantity < item.quantity) {
        problem = "Estoque insuficiente para a quantidade escolhida.";
      }

      let design: Doc<"designs"> | null = null;
      if (!problem && designId) {
        design = await ctx.db.get(designId);
        const usable =
          design &&
          design.active &&
          !design.archived &&
          design.compatibleProductIds.includes(product._id) &&
          isDesignCompatible(
            {
              supportedTechnologies: design.supportedTechnologies,
              compatibleVariantIds: (design.compatibleVariantIds ?? []).map(String),
            },
            variant ? { id: variant._id, technology: variant.options.technology } : null,
          );
        if (!usable) problem = "O design escolhido não está mais disponível.";
      }

      const unit = unitPriceCents({
        basePriceCents: product.basePriceCents,
        variantAdjustmentCents: variant?.priceAdjustmentCents,
        designAdjustmentCents: design?.priceAdjustmentCents,
      });
      const total = problem ? 0 : lineTotalCents(unit, item.quantity);
      subtotalCents += total;

      const [image] = await imageUrls(ctx, (design?.imageStorageIds ?? product.imageStorageIds).slice(0, 1));
      lines.push({
        ...base,
        name: product.name,
        variantName: variant?.name ?? null,
        designName: design?.name ?? null,
        imageUrl: image ?? null,
        unitPriceCents: unit,
        lineTotalCents: total,
        problem,
      });
    }

    return { lines, subtotalCents };
  },
});
