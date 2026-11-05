import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAdmin } from "./access";
import { audit } from "./lib/audit";
import { syncImages } from "./lib/images";
import { assertInt, assertSlug, cleanText, fail, optionalText } from "./lib/validate";

const technology = v.union(v.literal("qr"), v.literal("qr_nfc"), v.literal("nfc"));

async function withUrls(ctx: QueryCtx, ids: Id<"_storage">[]) {
  const result: { id: Id<"_storage">; url: string }[] = [];
  for (const id of ids) {
    const url = await ctx.storage.getUrl(id);
    if (url) result.push({ id, url });
  }
  return result;
}

async function logStock(
  ctx: MutationCtx,
  productId: Id<"products">,
  variantId: Id<"productVariants">,
  delta: number,
  reason: string,
  userId: Id<"users">,
) {
  if (delta === 0) return;
  await ctx.db.insert("inventoryMovements", {
    productId,
    variantId,
    quantityDelta: delta,
    reason,
    source: "admin",
    createdBy: userId,
    createdAt: Date.now(),
  });
}

/* ------------------------------- Catégories ------------------------------- */

export const listCategories = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const categories = await ctx.db.query("categories").collect();
    categories.sort((a, b) => a.sortOrder - b.sortOrder);
    return Promise.all(
      categories.map(async (category) => ({
        ...category,
        image: category.imageStorageId ? (await withUrls(ctx, [category.imageStorageId]))[0] ?? null : null,
      })),
    );
  },
});

export const saveCategory = mutation({
  args: {
    id: v.optional(v.id("categories")),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    sortOrder: v.number(),
    active: v.boolean(),
    imageStorageId: v.union(v.id("_storage"), v.null()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const name = cleanText(args.name, "Nome", 80);
    const slug = assertSlug(args.slug);
    const description = optionalText(args.description, "Descrição", 500);
    const sortOrder = assertInt(args.sortOrder, "Ordem", 0, 10000);

    const clash = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (clash && clash._id !== args.id) fail("Já existe uma categoria com este slug.");

    const existing = args.id ? await ctx.db.get(args.id) : null;
    if (args.id && !existing) fail("Categoria não encontrada.");
    await syncImages(
      ctx,
      existing?.imageStorageId ? [existing.imageStorageId] : [],
      args.imageStorageId ? [args.imageStorageId] : [],
    );

    const fields = {
      name,
      slug,
      description,
      sortOrder,
      active: args.active,
      imageStorageId: args.imageStorageId ?? undefined,
      updatedAt: Date.now(),
    };
    let id: Id<"categories">;
    if (existing) {
      id = existing._id;
      await ctx.db.patch(id, fields);
    } else {
      id = await ctx.db.insert("categories", { ...fields, createdAt: Date.now() });
    }
    await audit(ctx, admin._id, existing ? "category.update" : "category.create", "category", id, { name });
    return id;
  },
});

export const setCategoryActive = mutation({
  args: { id: v.id("categories"), active: v.boolean() },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    await ctx.db.patch(args.id, { active: args.active, updatedAt: Date.now() });
    await audit(ctx, admin._id, "category.setActive", "category", args.id, { active: args.active });
  },
});

/* -------------------------------- Produits -------------------------------- */

export const listProducts = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const products = await ctx.db.query("products").take(500);
    products.sort((a, b) => b.createdAt - a.createdAt);
    return Promise.all(
      products.map(async (product) => {
        const variants = await ctx.db
          .query("productVariants")
          .withIndex("by_product", (q) => q.eq("productId", product._id))
          .collect();
        const [image] = await withUrls(ctx, product.imageStorageIds.slice(0, 1));
        return {
          _id: product._id,
          name: product.name,
          slug: product.slug,
          basePriceCents: product.basePriceCents,
          active: product.active,
          featured: product.featured,
          archived: product.archived ?? false,
          isDemo: product.isDemo ?? false,
          variantCount: variants.filter((variant) => variant.active).length,
          totalStock: variants.reduce((sum, variant) => sum + variant.stockQuantity, 0),
          imageUrl: image?.url ?? null,
        };
      }),
    );
  },
});

export const getProduct = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const id = ctx.db.normalizeId("products", args.id);
    const product = id ? await ctx.db.get(id) : null;
    if (!product) return null;
    const variants = await ctx.db
      .query("productVariants")
      .withIndex("by_product", (q) => q.eq("productId", product._id))
      .collect();
    return {
      product: { ...product, images: await withUrls(ctx, product.imageStorageIds) },
      variants,
    };
  },
});

export const saveProduct = mutation({
  args: {
    id: v.optional(v.id("products")),
    name: v.string(),
    slug: v.string(),
    shortDescription: v.optional(v.string()),
    description: v.optional(v.string()),
    categoryIds: v.array(v.id("categories")),
    imageStorageIds: v.array(v.id("_storage")),
    basePriceCents: v.number(),
    active: v.boolean(),
    featured: v.boolean(),
    weightGrams: v.number(),
    packageLengthCm: v.number(),
    packageWidthCm: v.number(),
    packageHeightCm: v.number(),
    stockManaged: v.boolean(),
    availableTechnologies: v.array(technology),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const { id, ...input } = args;
    const name = cleanText(input.name, "Nome", 120);
    const slug = assertSlug(input.slug);
    assertInt(input.basePriceCents, "Preço", 0, 100_000_000);
    assertInt(input.weightGrams, "Peso (g)", 1, 100_000);
    assertInt(input.packageLengthCm, "Comprimento (cm)", 1, 300);
    assertInt(input.packageWidthCm, "Largura (cm)", 1, 300);
    assertInt(input.packageHeightCm, "Altura (cm)", 1, 300);
    if (input.imageStorageIds.length > 10) fail("No máximo 10 imagens por produto.");

    const clash = await ctx.db
      .query("products")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (clash && clash._id !== id) fail("Já existe um produto com este slug.");

    for (const categoryId of input.categoryIds) {
      if (!(await ctx.db.get(categoryId))) fail("Categoria inexistente.");
    }

    const existing = id ? await ctx.db.get(id) : null;
    if (id && !existing) fail("Produto não encontrado.");
    await syncImages(ctx, existing?.imageStorageIds ?? [], input.imageStorageIds);

    const fields = {
      ...input,
      name,
      slug,
      shortDescription: optionalText(input.shortDescription, "Descrição curta", 300),
      description: optionalText(input.description, "Descrição", 5000),
      updatedAt: Date.now(),
    };
    let productId: Id<"products">;
    if (existing) {
      productId = existing._id;
      await ctx.db.patch(productId, fields);
    } else {
      productId = await ctx.db.insert("products", { ...fields, createdAt: Date.now() });
    }
    await audit(ctx, admin._id, existing ? "product.update" : "product.create", "product", productId, { name });
    return productId;
  },
});

export const setProductFlags = mutation({
  args: {
    id: v.id("products"),
    active: v.optional(v.boolean()),
    featured: v.optional(v.boolean()),
    archived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const patch: Partial<Doc<"products">> = { updatedAt: Date.now() };
    if (args.active !== undefined) patch.active = args.active;
    if (args.featured !== undefined) patch.featured = args.featured;
    if (args.archived !== undefined) {
      patch.archived = args.archived;
      if (args.archived) patch.active = false; // un produit archivé n'est jamais publié
    }
    await ctx.db.patch(args.id, patch);
    await audit(ctx, admin._id, "product.flags", "product", args.id, {
      active: patch.active ?? null,
      featured: patch.featured ?? null,
      archived: patch.archived ?? null,
    });
  },
});

/* -------------------------------- Variantes ------------------------------- */

export const saveVariant = mutation({
  args: {
    id: v.optional(v.id("productVariants")),
    productId: v.id("products"),
    name: v.string(),
    sku: v.optional(v.string()),
    format: v.optional(v.string()),
    thickness: v.optional(v.string()),
    finish: v.optional(v.string()),
    technology: v.optional(technology),
    priceAdjustmentCents: v.number(),
    stockQuantity: v.number(),
    lowStockThreshold: v.optional(v.number()),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (!(await ctx.db.get(args.productId))) fail("Produto não encontrado.");
    const name = cleanText(args.name, "Nome da opção", 120);
    const sku = optionalText(args.sku, "SKU", 60);
    assertInt(args.priceAdjustmentCents, "Ajuste de preço", -100_000_000, 100_000_000);
    assertInt(args.stockQuantity, "Estoque", 0, 1_000_000);
    if (args.lowStockThreshold !== undefined) assertInt(args.lowStockThreshold, "Alerta de estoque", 0, 1_000_000);

    if (sku) {
      const clash = await ctx.db
        .query("productVariants")
        .withIndex("by_sku", (q) => q.eq("sku", sku))
        .first();
      if (clash && clash._id !== args.id) fail("Já existe uma opção com este SKU.");
    }

    const existing = args.id ? await ctx.db.get(args.id) : null;
    if (args.id && (!existing || existing.productId !== args.productId)) fail("Opção não encontrada.");

    const fields = {
      productId: args.productId,
      name,
      sku,
      options: {
        format: optionalText(args.format, "Formato", 60),
        thickness: optionalText(args.thickness, "Espessura", 60),
        finish: optionalText(args.finish, "Acabamento", 60),
        technology: args.technology,
      },
      priceAdjustmentCents: args.priceAdjustmentCents,
      stockQuantity: args.stockQuantity,
      lowStockThreshold: args.lowStockThreshold,
      active: args.active,
    };

    let variantId: Id<"productVariants">;
    if (existing) {
      variantId = existing._id;
      await ctx.db.patch(variantId, fields);
      await logStock(ctx, args.productId, variantId, args.stockQuantity - existing.stockQuantity, "Ajuste manual", admin._id);
    } else {
      variantId = await ctx.db.insert("productVariants", fields);
      await logStock(ctx, args.productId, variantId, args.stockQuantity, "Estoque inicial", admin._id);
    }
    await audit(ctx, admin._id, existing ? "variant.update" : "variant.create", "variant", variantId, { name });
    return variantId;
  },
});

/* --------------------------------- Designs -------------------------------- */

export const listDesigns = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const designs = await ctx.db.query("designs").collect();
    designs.sort((a, b) => a.sortOrder - b.sortOrder);
    return Promise.all(designs.map(async (design) => ({ ...design, images: await withUrls(ctx, design.imageStorageIds) })));
  },
});

export const saveDesign = mutation({
  args: {
    id: v.optional(v.id("designs")),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    imageStorageIds: v.array(v.id("_storage")),
    sortOrder: v.number(),
    active: v.boolean(),
    compatibleProductIds: v.array(v.id("products")),
    supportedTechnologies: v.array(technology),
    priceAdjustmentCents: v.number(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const { id, ...input } = args;
    const name = cleanText(input.name, "Nome", 120);
    const slug = assertSlug(input.slug);
    assertInt(input.sortOrder, "Ordem", 0, 10000);
    assertInt(input.priceAdjustmentCents, "Suplemento", 0, 100_000_000);
    if (input.imageStorageIds.length > 10) fail("No máximo 10 imagens por design.");
    if (input.supportedTechnologies.length === 0) fail("Escolha ao menos uma tecnologia.");

    const clash = await ctx.db
      .query("designs")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (clash && clash._id !== id) fail("Já existe um design com este slug.");

    for (const productId of input.compatibleProductIds) {
      if (!(await ctx.db.get(productId))) fail("Produto inexistente na lista de compatibilidade.");
    }

    const existing = id ? await ctx.db.get(id) : null;
    if (id && !existing) fail("Design não encontrado.");
    await syncImages(ctx, existing?.imageStorageIds ?? [], input.imageStorageIds);

    const fields = {
      ...input,
      name,
      slug,
      description: optionalText(input.description, "Descrição", 1000),
      updatedAt: Date.now(),
    };
    let designId: Id<"designs">;
    if (existing) {
      designId = existing._id;
      await ctx.db.patch(designId, fields);
    } else {
      designId = await ctx.db.insert("designs", { ...fields, createdAt: Date.now() });
    }
    await audit(ctx, admin._id, existing ? "design.update" : "design.create", "design", designId, { name });
    return designId;
  },
});

/** Un design n'est jamais supprimé physiquement : archivage logique (les commandes y font référence). */
export const setDesignState = mutation({
  args: { id: v.id("designs"), active: v.optional(v.boolean()), archived: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const patch: Partial<Doc<"designs">> = { updatedAt: Date.now() };
    if (args.active !== undefined) patch.active = args.active;
    if (args.archived !== undefined) {
      patch.archived = args.archived;
      if (args.archived) patch.active = false;
    }
    await ctx.db.patch(args.id, patch);
    await audit(ctx, admin._id, "design.state", "design", args.id, {
      active: patch.active ?? null,
      archived: patch.archived ?? null,
    });
  },
});
