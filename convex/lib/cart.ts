import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { isDesignCompatible, isValidQuantity, lineTotalCents, unitPriceCents } from "../../shared/pricing";

/** Le panier du navigateur ne contient que des identifiants et des quantités, jamais de prix. */
export const cartItemsValidator = v.array(
  v.object({
    productId: v.string(),
    variantId: v.optional(v.string()),
    designId: v.optional(v.string()),
    quantity: v.number(),
  }),
);

export interface CartInputItem {
  productId: string;
  variantId?: string;
  designId?: string;
  quantity: number;
}

export interface Physical {
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

export interface PricedLine {
  productId: string;
  variantId: string | null;
  designId: string | null;
  quantity: number;
  name: string;
  variantName: string | null;
  designName: string | null;
  imageUrl: string | null;
  unitPriceCents: number;
  lineTotalCents: number;
  problem: string | null;
  /** Poids et dimensions d'expédition (variante prioritaire sur le produit). Absent pour une ligne invalide. */
  physical: Physical | null;
}

export const MAX_CART_LINES = 50;

export async function imageUrls(ctx: QueryCtx, ids: Id<"_storage">[]): Promise<string[]> {
  const urls = await Promise.all(ids.map((id) => ctx.storage.getUrl(id)));
  return urls.filter((u): u is string => u !== null);
}

export async function activeVariants(ctx: QueryCtx, productId: Id<"products">) {
  const variants = await ctx.db
    .query("productVariants")
    .withIndex("by_product", (q) => q.eq("productId", productId))
    .collect();
  return variants.filter((variant) => variant.active);
}

/**
 * Source de vérité des prix du panier : recalcul complet côté serveur (produit, option, design, quantité, stock).
 * Les lignes invalides sont signalées (problem) et exclues du sous-total.
 */
export async function priceCartLines(
  ctx: QueryCtx,
  rawItems: CartInputItem[],
  options: { withImages: boolean },
): Promise<{ lines: PricedLine[]; subtotalCents: number }> {
  const items = rawItems.slice(0, MAX_CART_LINES);
  const lines: PricedLine[] = [];
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
    const invalid = (problem: string, name = "Produto indisponível"): PricedLine => ({
      ...base,
      name,
      variantName: null,
      designName: null,
      imageUrl: null,
      unitPriceCents: 0,
      lineTotalCents: 0,
      problem,
      physical: null,
    });

    const product = productId ? await ctx.db.get(productId) : null;
    if (!product || !product.active || product.archived) {
      lines.push(invalid("Este produto não está mais disponível."));
      continue;
    }
    if (!isValidQuantity(item.quantity)) {
      lines.push(invalid("Quantidade inválida.", product.name));
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

    let imageUrl: string | null = null;
    if (options.withImages) {
      const [image] = await imageUrls(ctx, (design?.imageStorageIds ?? product.imageStorageIds).slice(0, 1));
      imageUrl = image ?? null;
    }

    lines.push({
      ...base,
      name: product.name,
      variantName: variant?.name ?? null,
      designName: design?.name ?? null,
      imageUrl,
      unitPriceCents: unit,
      lineTotalCents: total,
      problem,
      physical: {
        weightGrams: variant?.weightGrams ?? product.weightGrams,
        lengthCm: variant?.packageLengthCm ?? product.packageLengthCm,
        widthCm: variant?.packageWidthCm ?? product.packageWidthCm,
        heightCm: variant?.packageHeightCm ?? product.packageHeightCm,
      },
    });
  }

  return { lines, subtotalCents };
}
