// Règles de livraison — partagées entre le backend Convex et les tests.
// Tous les montants sont en centavos (entiers).

export const DEFAULT_SHIPPING_MARKUP_CENTS = 500; // R$ 5,00, configurable par l'administrateur

export type AllowedService = "PAC" | "SEDEX";

export interface RawMelhorEnvioQuote {
  id?: number | string;
  name?: string;
  company?: { name?: string } | null;
  price?: string | number | null;
  custom_price?: string | number | null;
  delivery_time?: number | null;
  custom_delivery_time?: number | null;
  error?: string | null;
}

export interface CustomerShippingOption {
  service: AllowedService;
  providerServiceId: string;
  basePriceCents: number;
  markupCents: number;
  customerPriceCents: number;
  deliveryDays: number | null;
}

export interface ShippingConfig {
  markupCents: number;
  enablePac: boolean;
  enableSedex: boolean;
}

/** Convertit un prix décimal retourné par l'API ("18.50" ou 18.5) en centavos, sans flottants. */
export function priceToCents(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const text = typeof value === "number" ? value.toFixed(2) : String(value).trim();
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(text);
  if (!match) return null;
  const reais = Number(match[1]);
  const cents = Number((match[2] ?? "0").padEnd(2, "0"));
  return reais * 100 + cents;
}

function detectService(quote: RawMelhorEnvioQuote): AllowedService | null {
  const company = (quote.company?.name ?? "").trim().toLowerCase();
  if (!company.includes("correios")) return null;
  const name = (quote.name ?? "").trim().toUpperCase();
  if (name === "PAC") return "PAC";
  if (name === "SEDEX") return "SEDEX";
  return null; // ex.: "SEDEX 10", "SEDEX 12", "Mini Envios" => filtrés
}

/**
 * Conserve uniquement Correios PAC et SEDEX, ajoute le supplément une seule fois par option.
 * Les services en erreur ou sans prix valide sont ignorés.
 */
export function buildCustomerOptions(
  quotes: RawMelhorEnvioQuote[],
  config: ShippingConfig,
): CustomerShippingOption[] {
  const options: CustomerShippingOption[] = [];
  for (const quote of quotes) {
    if (quote.error) continue;
    const service = detectService(quote);
    if (!service) continue;
    if (service === "PAC" && !config.enablePac) continue;
    if (service === "SEDEX" && !config.enableSedex) continue;
    const base = priceToCents(quote.custom_price ?? quote.price);
    if (base === null) continue;
    options.push({
      service,
      providerServiceId: String(quote.id ?? ""),
      basePriceCents: base,
      markupCents: config.markupCents,
      customerPriceCents: base + config.markupCents,
      deliveryDays: quote.custom_delivery_time ?? quote.delivery_time ?? null,
    });
  }
  return options.sort((a, b) => a.customerPriceCents - b.customerPriceCents);
}
