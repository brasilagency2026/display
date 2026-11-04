import { internalMutation } from "./_generated/server";

// Données de DÉMONSTRATION, toutes marquées isDemo et suffixées « [DEMO] ».
// Les prix et noms sont fictifs. Ne pas utiliser en production réelle.
//   npx convex run seed:seedDemo      (ajoute)
//   npx convex run seed:removeDemo    (supprime tout ce qui est marqué isDemo)

export const seedDemo = internalMutation({
  args: {},
  handler: async (ctx) => {
    const already = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", "restaurantes-e-cardapios"))
      .unique();
    if (already) return "Já existem dados com este slug. Nada foi criado.";

    const now = Date.now();
    const catNames = [
      ["Restaurantes e cardápios", "restaurantes-e-cardapios"],
      ["Bares e lanchonetes", "bares-e-lanchonetes"],
      ["Lojas e comércios", "lojas-e-comercios"],
    ] as const;
    const categoryIds = [];
    for (const [index, [name, slug]] of catNames.entries()) {
      categoryIds.push(
        await ctx.db.insert("categories", {
          name,
          slug,
          sortOrder: index,
          active: true,
          isDemo: true,
          createdAt: now,
          updatedAt: now,
        }),
      );
    }

    const sizes = [
      { label: "10 × 15 cm", extra: 0 },
      { label: "15 × 20 cm", extra: 1200 },
    ];
    const techs = [
      { key: "qr" as const, label: "QR Code", extra: 0 },
      { key: "qr_nfc" as const, label: "QR Code + NFC", extra: 1500 },
    ];
    const products = [
      { name: "Display de mesa [DEMO]", slug: "demo-display-de-mesa", base: 4990, cat: 0, featured: true },
      { name: "Placa acrílica para balcão [DEMO]", slug: "demo-placa-balcao", base: 6990, cat: 1, featured: true },
      { name: "Display de parede [DEMO]", slug: "demo-display-de-parede", base: 5990, cat: 2, featured: false },
    ];

    const productIds = [];
    for (const [index, product] of products.entries()) {
      const productId = await ctx.db.insert("products", {
        name: product.name,
        slug: product.slug,
        shortDescription: "Produto de demonstração — substitua pelos dados reais.",
        description: "Item fictício criado para testar a loja. Remova-o antes de vender.",
        categoryIds: [categoryIds[product.cat]],
        imageStorageIds: [],
        basePriceCents: product.base,
        active: true,
        isDemo: true,
        featured: product.featured,
        weightGrams: 150,
        packageLengthCm: 20,
        packageWidthCm: 15,
        packageHeightCm: 3,
        stockManaged: true,
        availableTechnologies: ["qr", "qr_nfc"],
        createdAt: now + index,
        updatedAt: now + index,
      });
      productIds.push(productId);
      for (const size of sizes) {
        for (const tech of techs) {
          await ctx.db.insert("productVariants", {
            productId,
            name: `${size.label} · ${tech.label}`,
            options: { format: size.label, thickness: "3 mm", technology: tech.key },
            priceAdjustmentCents: size.extra + tech.extra,
            stockQuantity: 25,
            active: true,
            isDemo: true,
          });
        }
      }
    }

    const designs = [
      { name: "Cardápio clássico [DEMO]", extra: 0 },
      { name: "Minimalista branco [DEMO]", extra: 0 },
      { name: "Escuro elegante [DEMO]", extra: 500 },
      { name: "WhatsApp direto [DEMO]", extra: 0 },
    ];
    for (const [index, design] of designs.entries()) {
      await ctx.db.insert("designs", {
        name: design.name,
        slug: `demo-design-${index + 1}`,
        description: "Modelo de demonstração.",
        imageStorageIds: [],
        sortOrder: index,
        active: true,
        isDemo: true,
        compatibleProductIds: productIds,
        supportedTechnologies: ["qr", "qr_nfc"],
        priceAdjustmentCents: design.extra,
        createdAt: now,
        updatedAt: now,
      });
    }
    return "Dados de demonstração criados.";
  },
});

export const removeDemo = internalMutation({
  args: {},
  handler: async (ctx) => {
    const counts: Record<string, number> = {};
    for (const table of ["designs", "productVariants", "products", "categories"] as const) {
      const rows = await ctx.db.query(table).collect();
      let removed = 0;
      for (const row of rows) {
        if (row.isDemo) {
          await ctx.db.delete(row._id);
          removed += 1;
        }
      }
      counts[table] = removed;
    }
    return counts;
  },
});
