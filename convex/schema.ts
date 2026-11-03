import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// Montants en centavos (entiers). Timestamps en ms UTC.

const role = v.union(
  v.literal("super_admin"),
  v.literal("admin"),
  v.literal("customer"),
  v.literal("affiliate"),
);

const technology = v.union(v.literal("qr"), v.literal("qr_nfc"), v.literal("nfc"));

export default defineSchema({
  ...authTables,

  // Étend la table users de Convex Auth.
  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    image: v.optional(v.string()),
    phone: v.optional(v.string()),
    role: v.optional(role), // absent = customer
    status: v.optional(v.union(v.literal("active"), v.literal("blocked"))),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  }).index("email", ["email"]),

  addresses: defineTable({
    userId: v.id("users"),
    recipientName: v.string(),
    cep: v.string(),
    street: v.string(),
    number: v.string(),
    complement: v.optional(v.string()),
    neighborhood: v.string(),
    city: v.string(),
    state: v.string(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  categories: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    sortOrder: v.number(),
    active: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_active_sort", ["active", "sortOrder"]),

  products: defineTable({
    name: v.string(),
    slug: v.string(),
    shortDescription: v.optional(v.string()),
    description: v.optional(v.string()),
    categoryIds: v.array(v.id("categories")),
    imageStorageIds: v.array(v.id("_storage")),
    basePriceCents: v.number(),
    active: v.boolean(),
    featured: v.boolean(),
    archived: v.optional(v.boolean()),
    weightGrams: v.number(),
    packageLengthCm: v.number(),
    packageWidthCm: v.number(),
    packageHeightCm: v.number(),
    stockManaged: v.boolean(),
    availableTechnologies: v.array(technology),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_active_featured", ["active", "featured"])
    .index("by_active", ["active"]),

  productVariants: defineTable({
    productId: v.id("products"),
    name: v.string(),
    sku: v.optional(v.string()),
    options: v.object({
      format: v.optional(v.string()),
      thickness: v.optional(v.string()),
      finish: v.optional(v.string()),
      technology: v.optional(technology),
    }),
    priceAdjustmentCents: v.number(),
    stockQuantity: v.number(),
    lowStockThreshold: v.optional(v.number()),
    weightGrams: v.optional(v.number()),
    packageLengthCm: v.optional(v.number()),
    packageWidthCm: v.optional(v.number()),
    packageHeightCm: v.optional(v.number()),
    active: v.boolean(),
  })
    .index("by_product", ["productId"])
    .index("by_sku", ["sku"]),

  // Designs : créés et gérés exclusivement par l'administrateur.
  designs: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    imageStorageIds: v.array(v.id("_storage")),
    sortOrder: v.number(),
    active: v.boolean(),
    archived: v.optional(v.boolean()),
    compatibleProductIds: v.array(v.id("products")),
    compatibleVariantIds: v.optional(v.array(v.id("productVariants"))),
    supportedTechnologies: v.array(technology),
    priceAdjustmentCents: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_active_sort", ["active", "sortOrder"]),

  carts: defineTable({
    userId: v.optional(v.id("users")),
    guestSessionId: v.optional(v.string()),
    items: v.array(
      v.object({
        productId: v.id("products"),
        variantId: v.optional(v.id("productVariants")),
        designId: v.optional(v.id("designs")),
        technology: technology,
        quantity: v.number(),
      }),
    ),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_guest", ["guestSessionId"]),

  orders: defineTable({
    orderNumber: v.string(),
    userId: v.optional(v.id("users")),
    customerSnapshot: v.object({
      name: v.string(),
      email: v.string(),
      phone: v.string(),
      document: v.optional(v.string()),
    }),
    shippingAddressSnapshot: v.object({
      cep: v.string(),
      street: v.string(),
      number: v.string(),
      complement: v.optional(v.string()),
      neighborhood: v.string(),
      city: v.string(),
      state: v.string(),
      reference: v.optional(v.string()),
    }),
    subtotalCents: v.number(),
    shippingProvider: v.literal("melhor_envio"),
    shippingService: v.union(v.literal("PAC"), v.literal("SEDEX")),
    shippingBaseCents: v.number(),
    shippingMarkupCents: v.number(),
    shippingTotalCents: v.number(),
    totalCents: v.number(),
    currency: v.literal("BRL"),
    // Trois statuts séparés, jamais confondus.
    paymentStatus: v.string(),
    productionStatus: v.string(),
    shippingStatus: v.string(),
    affiliateId: v.optional(v.id("affiliates")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_number", ["orderNumber"])
    .index("by_user", ["userId", "createdAt"])
    .index("by_payment_status", ["paymentStatus", "createdAt"])
    .index("by_production_status", ["productionStatus", "createdAt"])
    .index("by_created", ["createdAt"]),

  orderItems: defineTable({
    orderId: v.id("orders"),
    productId: v.id("products"),
    variantId: v.optional(v.id("productVariants")),
    designId: v.optional(v.id("designs")),
    productNameSnapshot: v.string(),
    variantSnapshot: v.optional(v.string()),
    designSnapshot: v.optional(v.string()),
    unitPriceCents: v.number(),
    quantity: v.number(),
    lineTotalCents: v.number(),
    qrNfcMode: technology,
  }).index("by_order", ["orderId"]),

  payments: defineTable({
    orderId: v.id("orders"),
    provider: v.literal("mercado_pago"),
    providerPaymentId: v.optional(v.string()),
    providerPreferenceId: v.optional(v.string()),
    status: v.string(),
    rawStatus: v.optional(v.string()),
    amountCents: v.number(),
    currency: v.literal("BRL"),
    idempotencyKey: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_order", ["orderId"])
    .index("by_provider_payment", ["providerPaymentId"])
    .index("by_idempotency", ["idempotencyKey"]),

  // Idempotence des webhooks (Mercado Pago, Mercado Livre).
  webhookEvents: defineTable({
    provider: v.string(),
    externalEventId: v.string(),
    status: v.union(v.literal("received"), v.literal("processed"), v.literal("failed")),
    error: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_provider_event", ["provider", "externalEventId"]),

  shippingQuotes: defineTable({
    cartRef: v.string(),
    originCep: v.string(),
    destinationCep: v.string(),
    service: v.union(v.literal("PAC"), v.literal("SEDEX")),
    providerServiceId: v.string(),
    basePriceCents: v.number(),
    markupCents: v.number(),
    customerPriceCents: v.number(),
    deliveryDays: v.optional(v.number()),
    expiresAt: v.number(),
    createdAt: v.number(),
  }).index("by_cart", ["cartRef"]),

  shipments: defineTable({
    orderId: v.id("orders"),
    provider: v.literal("melhor_envio"),
    service: v.union(v.literal("PAC"), v.literal("SEDEX")),
    providerShipmentId: v.optional(v.string()),
    trackingCode: v.optional(v.string()),
    labelStorageId: v.optional(v.id("_storage")),
    actualCostCents: v.optional(v.number()),
    customerShippingPriceCents: v.number(),
    status: v.string(),
    postedAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_order", ["orderId"])
    .index("by_tracking", ["trackingCode"]),

  displayUnits: defineTable({
    orderId: v.id("orders"),
    orderItemId: v.id("orderItems"),
    publicCode: v.string(),
    destinationUrl: v.optional(v.string()),
    destinationActive: v.boolean(),
    qrAssetStorageId: v.optional(v.id("_storage")),
    nfcTagIdentifier: v.optional(v.string()),
    nfcProgrammingStatus: v.string(),
    qrVerificationStatus: v.string(),
    productionStatus: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_public_code", ["publicCode"])
    .index("by_order", ["orderId"]),

  redirectEvents: defineTable({
    displayUnitId: v.id("displayUnits"),
    createdAt: v.number(),
  }).index("by_unit", ["displayUnitId", "createdAt"]),

  affiliates: defineTable({
    userId: v.id("users"),
    affiliateCode: v.string(),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    commissionRateBasisPoints: v.number(),
    createdAt: v.number(),
    approvedAt: v.optional(v.number()),
  })
    .index("by_code", ["affiliateCode"])
    .index("by_user", ["userId"]),

  affiliateClicks: defineTable({
    affiliateId: v.id("affiliates"),
    anonymousSessionId: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
  }).index("by_affiliate", ["affiliateId", "createdAt"]),

  commissions: defineTable({
    affiliateId: v.id("affiliates"),
    orderId: v.id("orders"),
    baseAmountCents: v.number(),
    rateBasisPoints: v.number(),
    commissionAmountCents: v.number(),
    status: v.string(),
    approvedAt: v.optional(v.number()),
    paidAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_affiliate_status", ["affiliateId", "status"])
    .index("by_order", ["orderId"]),

  affiliatePayoutRequests: defineTable({
    affiliateId: v.id("affiliates"),
    amountCents: v.number(),
    status: v.string(),
    requestedAt: v.number(),
    reviewedAt: v.optional(v.number()),
    paidAt: v.optional(v.number()),
    adminNotes: v.optional(v.string()),
  }).index("by_affiliate", ["affiliateId", "requestedAt"]),

  // Aucun token ici : les secrets OAuth restent dans les secrets Convex / stockage serveur.
  marketplaceAccounts: defineTable({
    provider: v.literal("mercado_livre"),
    sellerId: v.optional(v.string()),
    status: v.string(),
    connectedAt: v.optional(v.number()),
  }).index("by_provider", ["provider"]),

  marketplaceListings: defineTable({
    productId: v.id("products"),
    provider: v.literal("mercado_livre"),
    externalListingId: v.optional(v.string()),
    externalUrl: v.optional(v.string()),
    status: v.string(),
    lastSyncAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_product", ["productId"])
    .index("by_external", ["externalListingId"]),

  marketplaceOrders: defineTable({
    provider: v.literal("mercado_livre"),
    externalOrderId: v.string(),
    externalStatus: v.string(),
    amountCents: v.number(),
    stockProcessed: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_external", ["provider", "externalOrderId"]),

  inventoryMovements: defineTable({
    productId: v.id("products"),
    variantId: v.optional(v.id("productVariants")),
    quantityDelta: v.number(),
    reason: v.string(),
    orderId: v.optional(v.id("orders")),
    source: v.string(),
    createdBy: v.optional(v.id("users")),
    createdAt: v.number(),
  }).index("by_product", ["productId", "createdAt"]),

  // Paramètres publics non sensibles uniquement.
  settings: defineTable({
    key: v.string(),
    value: v.any(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  auditLogs: defineTable({
    actorUserId: v.optional(v.id("users")),
    action: v.string(),
    entityType: v.string(),
    entityId: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  }).index("by_entity", ["entityType", "entityId"]),
});
