// Règles de prix et de compatibilité — partagées entre Convex (source de vérité) et le frontend (affichage).
// Tous les montants sont en centavos (entiers).

export const MAX_QUANTITY = 999;

export type Technology = "qr" | "qr_nfc" | "nfc";

export function isValidQuantity(quantity: number): boolean {
  return Number.isInteger(quantity) && quantity >= 1 && quantity <= MAX_QUANTITY;
}

export interface UnitPriceInput {
  basePriceCents: number;
  variantAdjustmentCents?: number;
  designAdjustmentCents?: number;
}

/** Prix unitaire = base produit + ajustement variante + supplément design (jamais négatif). */
export function unitPriceCents(input: UnitPriceInput): number {
  const total =
    input.basePriceCents +
    (input.variantAdjustmentCents ?? 0) +
    (input.designAdjustmentCents ?? 0);
  return Math.max(0, total);
}

export function lineTotalCents(unitCents: number, quantity: number): number {
  return unitCents * quantity;
}

export interface DesignRules {
  supportedTechnologies: Technology[];
  /** Si renseigné et non vide, le design n'est valable que pour ces variantes. */
  compatibleVariantIds?: string[];
}

/** Un design est sélectionnable pour une variante seulement si technologie et variante sont compatibles. */
export function isDesignCompatible(
  design: DesignRules,
  variant: { id: string; technology?: Technology } | null,
): boolean {
  if (!variant) return true;
  const restricted = design.compatibleVariantIds;
  if (restricted && restricted.length > 0 && !restricted.includes(variant.id)) return false;
  if (variant.technology && !design.supportedTechnologies.includes(variant.technology)) return false;
  return true;
}
