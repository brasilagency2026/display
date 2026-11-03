import { describe, expect, it } from "vitest";
import {
  buildCustomerOptions,
  priceToCents,
  type RawMelhorEnvioQuote,
} from "../shared/shipping";

const config = { markupCents: 500, enablePac: true, enableSedex: true };
const correios = { name: "Correios" };

const pac: RawMelhorEnvioQuote = { id: 1, name: "PAC", company: correios, price: "18.50", delivery_time: 6 };
const sedex: RawMelhorEnvioQuote = { id: 2, name: "SEDEX", company: correios, price: "32.10", delivery_time: 2 };
const jadlog: RawMelhorEnvioQuote = { id: 3, name: ".Package", company: { name: "Jadlog" }, price: "15.00" };
const sedex10: RawMelhorEnvioQuote = { id: 4, name: "SEDEX 10", company: correios, price: "60.00" };

describe("priceToCents", () => {
  it("convertit sans erreur de flottant", () => {
    expect(priceToCents("18.50")).toBe(1850);
    expect(priceToCents(18.5)).toBe(1850);
    expect(priceToCents("0.10")).toBe(10);
    expect(priceToCents("1,5")).toBe(150);
    expect(priceToCents("abc")).toBeNull();
    expect(priceToCents(null)).toBeNull();
  });
});

describe("buildCustomerOptions", () => {
  it("PAC seul", () => {
    const r = buildCustomerOptions([pac], config);
    expect(r.map((o) => o.service)).toEqual(["PAC"]);
  });
  it("SEDEX seul", () => {
    const r = buildCustomerOptions([sedex], config);
    expect(r.map((o) => o.service)).toEqual(["SEDEX"]);
  });
  it("PAC et SEDEX", () => {
    const r = buildCustomerOptions([sedex, pac], config);
    expect(r.map((o) => o.service)).toEqual(["PAC", "SEDEX"]);
  });
  it("filtre les autres transporteurs et services", () => {
    expect(buildCustomerOptions([jadlog, sedex10], config)).toEqual([]);
    expect(buildCustomerOptions([jadlog, pac, sedex10], config).map((o) => o.service)).toEqual(["PAC"]);
  });
  it("ajoute R$ 5,00 une seule fois : 1850 + 500 = 2350", () => {
    const [o] = buildCustomerOptions([pac], config);
    expect(o.basePriceCents).toBe(1850);
    expect(o.markupCents).toBe(500);
    expect(o.customerPriceCents).toBe(2350);
  });
  it("applique un supplément modifié par l'administrateur", () => {
    const [o] = buildCustomerOptions([pac], { ...config, markupCents: 800 });
    expect(o.customerPriceCents).toBe(2650);
  });
  it("respecte l'activation PAC/SEDEX", () => {
    const r = buildCustomerOptions([pac, sedex], { ...config, enableSedex: false });
    expect(r.map((o) => o.service)).toEqual(["PAC"]);
  });
  it("ignore les services en erreur", () => {
    expect(buildCustomerOptions([{ ...pac, error: "Serviço indisponível" }], config)).toEqual([]);
  });
});
