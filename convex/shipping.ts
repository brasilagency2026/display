import { ConvexError, v } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { cartItemsValidator, priceCartLines } from "./lib/cart";
import { DEFAULT_SHIPPING, readSetting } from "./lib/settings";
import { fail } from "./lib/validate";
import { ensureAccessToken, mockEnabled, realFetch } from "./melhorEnvio";
import {
  MelhorEnvioError,
  QUOTE_TTL_MS,
  buildCalculateBody,
  calculateQuotes,
  gramsToKg,
  isQuoteUsable,
  mockQuotes,
  quoteFingerprint,
} from "../shared/melhorEnvio";
import type { ShippingProduct } from "../shared/melhorEnvio";
import { buildCustomerOptions } from "../shared/shipping";
import type { RawMelhorEnvioQuote } from "../shared/shipping";

const NO_SERVICE_MESSAGE =
  "Não foi possível calcular o frete para este endereço. Entre em contato com o suporte.";
const UNAVAILABLE_MESSAGE = "Frete indisponível no momento. Tente novamente em instantes.";

/** Ce que le navigateur reçoit : jamais le tarif Melhor Envio ni le détail du supplément. */
export interface QuoteOption {
  quoteId: Id<"shippingQuotes">;
  service: "PAC" | "SEDEX";
  customerPriceCents: number;
  deliveryDays: number | null;
  expiresAt: number;
}
export interface QuoteResult {
  options: QuoteOption[];
  message: string | null;
  mock: boolean;
}

type Prepared =
  | { ok: false; message: string }
  | {
      ok: true;
      products: ShippingProduct[];
      originCep: string;
      markupCents: number;
      enablePac: boolean;
      enableSedex: boolean;
      fingerprint: string;
      cached: QuoteOption[];
      cachedIsMock: boolean;
    };

/** Lit le panier (prix et dimensions recalculés côté serveur), les réglages de frete et le cache de cotations valides. */
export const prepareQuote = internalQuery({
  args: { items: cartItemsValidator, cep: v.string() },
  handler: async (ctx, args): Promise<Prepared> => {
    const { lines } = await priceCartLines(ctx, args.items, { withImages: false });
    if (lines.length === 0) return { ok: false, message: "Carrinho vazio." };
    if (lines.some((line) => line.problem)) {
      return { ok: false, message: "Corrija os itens do carrinho antes de calcular o frete." };
    }

    const settings = await readSetting(ctx, "shipping", DEFAULT_SHIPPING);
    const products: ShippingProduct[] = lines.map((line) => {
      const physical = line.physical!;
      return {
        id: line.variantId ? `${line.productId}:${line.variantId}` : line.productId,
        width: physical.widthCm,
        height: physical.heightCm,
        length: physical.lengthCm,
        weight: gramsToKg(physical.weightGrams),
        insurance_value: 0, // valeur déclarée désactivée (à rendre configurable si le propriétaire le souhaite)
        quantity: line.quantity,
      };
    });

    const fingerprint = quoteFingerprint({
      cep: args.cep,
      markupCents: settings.markupCents,
      enablePac: settings.enablePac,
      enableSedex: settings.enableSedex,
      items: args.items,
    });
    const now = Date.now();
    const rows = await ctx.db
      .query("shippingQuotes")
      .withIndex("by_fingerprint", (q) => q.eq("fingerprint", fingerprint).gt("expiresAt", now))
      .collect();
    const usable = rows.filter((row) => isQuoteUsable(row.expiresAt, now));

    return {
      ok: true,
      products,
      originCep: settings.originCep,
      markupCents: settings.markupCents,
      enablePac: settings.enablePac,
      enableSedex: settings.enableSedex,
      fingerprint,
      cached: usable.map((row) => ({
        quoteId: row._id,
        service: row.service,
        customerPriceCents: row.customerPriceCents,
        deliveryDays: row.deliveryDays ?? null,
        expiresAt: row.expiresAt,
      })),
      cachedIsMock: usable.some((row) => row.isMock === true),
    };
  },
});

export const storeQuotes = internalMutation({
  args: {
    sessionRef: v.string(),
    fingerprint: v.string(),
    originCep: v.string(),
    destinationCep: v.string(),
    isMock: v.boolean(),
    options: v.array(
      v.object({
        service: v.union(v.literal("PAC"), v.literal("SEDEX")),
        providerServiceId: v.string(),
        basePriceCents: v.number(),
        markupCents: v.number(),
        customerPriceCents: v.number(),
        deliveryDays: v.union(v.number(), v.null()),
      }),
    ),
  },
  handler: async (ctx, args): Promise<QuoteOption[]> => {
    const now = Date.now();
    const expiresAt = now + QUOTE_TTL_MS;
    const saved: QuoteOption[] = [];
    for (const option of args.options) {
      const quoteId = await ctx.db.insert("shippingQuotes", {
        cartRef: args.sessionRef.slice(0, 64),
        originCep: args.originCep,
        destinationCep: args.destinationCep,
        service: option.service,
        providerServiceId: option.providerServiceId,
        basePriceCents: option.basePriceCents,
        markupCents: option.markupCents,
        customerPriceCents: option.customerPriceCents,
        deliveryDays: option.deliveryDays ?? undefined,
        expiresAt,
        createdAt: now,
        fingerprint: args.fingerprint,
        isMock: args.isMock,
      });
      saved.push({
        quoteId,
        service: option.service,
        customerPriceCents: option.customerPriceCents,
        deliveryDays: option.deliveryDays,
        expiresAt,
      });
    }
    return saved;
  },
});

/**
 * Cotation PAC / SEDEX pour le panier envoyé. Le navigateur n'envoie ni prix ni service :
 * tout est recalculé ici, le supplément configurable est ajouté une seule fois par option.
 */
export const quote = action({
  args: { cep: v.string(), items: cartItemsValidator, sessionRef: v.string() },
  handler: async (ctx, args): Promise<QuoteResult> => {
    const destinationCep = args.cep.replace(/\D/g, "");
    if (destinationCep.length !== 8) fail("CEP inválido. Informe 8 dígitos.");

    const prepared = await ctx.runQuery(internal.shipping.prepareQuote, { items: args.items, cep: destinationCep });
    if (!prepared.ok) fail(prepared.message);
    if (!prepared.originCep) fail("Frete indisponível: a loja ainda não configurou o CEP de origem.");
    if (!prepared.enablePac && !prepared.enableSedex) fail(UNAVAILABLE_MESSAGE);

    if (prepared.cached.length > 0) {
      return { options: prepared.cached, message: null, mock: prepared.cachedIsMock };
    }

    const mock = mockEnabled();
    let raw: RawMelhorEnvioQuote[];
    if (mock) {
      raw = mockQuotes(); // réponse FICTIVE, uniquement hors production
    } else {
      const userAgent = await ctx.runQuery(internal.melhorEnvio.getUserAgent, {});
      if (!userAgent) fail("Frete indisponível: a loja ainda não configurou o e-mail de contato.");
      try {
        const { accessToken, env } = await ensureAccessToken(ctx);
        raw = await calculateQuotes({
          env,
          accessToken,
          userAgent,
          body: buildCalculateBody({
            originCep: prepared.originCep.replace(/\D/g, ""),
            destinationCep,
            products: prepared.products,
          }),
          fetchFn: realFetch,
        });
      } catch (error) {
        if (error instanceof MelhorEnvioError && error.kind === "validation") fail(NO_SERVICE_MESSAGE);
        if (error instanceof MelhorEnvioError) console.error("Melhor Envio: cotation impossible", error.kind);
        else if (error instanceof ConvexError) console.error("Frete: configuração incompleta —", error.data); // message sans secret
        else console.error("Frete: cotation impossible");
        // Un ConvexError (ex.: « reconecter ») est une erreur de configuration : message neutre pour le client.
        fail(UNAVAILABLE_MESSAGE);
      }
    }

    const options = buildCustomerOptions(raw, {
      markupCents: prepared.markupCents,
      enablePac: prepared.enablePac,
      enableSedex: prepared.enableSedex,
    });
    if (options.length === 0) return { options: [], message: NO_SERVICE_MESSAGE, mock };

    const saved = await ctx.runMutation(internal.shipping.storeQuotes, {
      sessionRef: args.sessionRef,
      fingerprint: prepared.fingerprint,
      originCep: prepared.originCep.replace(/\D/g, ""),
      destinationCep,
      isMock: mock,
      options: options.map((option) => ({
        service: option.service,
        providerServiceId: option.providerServiceId,
        basePriceCents: option.basePriceCents,
        markupCents: option.markupCents,
        customerPriceCents: option.customerPriceCents,
        deliveryDays: option.deliveryDays,
      })),
    });
    return { options: saved, message: null, mock };
  },
});
