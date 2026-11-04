import { describe, expect, it } from "vitest";
import {
  isDesignCompatible,
  isValidQuantity,
  lineTotalCents,
  unitPriceCents,
} from "../shared/pricing";

describe("unitPriceCents", () => {
  it("additionne base, variante et design", () => {
    expect(
      unitPriceCents({ basePriceCents: 4990, variantAdjustmentCents: 1500, designAdjustmentCents: 500 }),
    ).toBe(6990);
  });
  it("traite les ajustements absents comme zéro", () => {
    expect(unitPriceCents({ basePriceCents: 4990 })).toBe(4990);
  });
  it("ne descend jamais sous zéro", () => {
    expect(unitPriceCents({ basePriceCents: 100, variantAdjustmentCents: -500 })).toBe(0);
  });
});

describe("lineTotalCents / quantité", () => {
  it("multiplie en entiers", () => {
    expect(lineTotalCents(1999, 3)).toBe(5997);
  });
  it("valide les quantités", () => {
    expect(isValidQuantity(1)).toBe(true);
    expect(isValidQuantity(999)).toBe(true);
    expect(isValidQuantity(0)).toBe(false);
    expect(isValidQuantity(1000)).toBe(false);
    expect(isValidQuantity(1.5)).toBe(false);
    expect(isValidQuantity(-2)).toBe(false);
  });
});

describe("isDesignCompatible", () => {
  const design = { supportedTechnologies: ["qr" as const] };
  it("accepte sans variante choisie", () => {
    expect(isDesignCompatible(design, null)).toBe(true);
  });
  it("refuse une technologie non supportée", () => {
    expect(isDesignCompatible(design, { id: "v1", technology: "qr_nfc" })).toBe(false);
    expect(isDesignCompatible(design, { id: "v1", technology: "qr" })).toBe(true);
  });
  it("respecte la liste de variantes autorisées", () => {
    const restricted = { supportedTechnologies: ["qr" as const], compatibleVariantIds: ["v2"] };
    expect(isDesignCompatible(restricted, { id: "v1", technology: "qr" })).toBe(false);
    expect(isDesignCompatible(restricted, { id: "v2", technology: "qr" })).toBe(true);
  });
  it("une liste vide ne restreint pas", () => {
    expect(
      isDesignCompatible({ supportedTechnologies: ["qr"], compatibleVariantIds: [] }, { id: "v1", technology: "qr" }),
    ).toBe(true);
  });
});
