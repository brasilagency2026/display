import { describe, expect, it } from "vitest";
import { centsToInput, parseBRL } from "../shared/money";
import { isValidSlug, slugify } from "../shared/slug";

describe("parseBRL", () => {
  it("comprend les formats brésiliens courants", () => {
    expect(parseBRL("49,90")).toBe(4990);
    expect(parseBRL("R$ 49,90")).toBe(4990);
    expect(parseBRL("1.234,56")).toBe(123456);
    expect(parseBRL("49.90")).toBe(4990);
    expect(parseBRL("49,9")).toBe(4990);
    expect(parseBRL("50")).toBe(5000);
    expect(parseBRL("1.234")).toBe(123400);
    expect(parseBRL(",50")).toBe(50);
    expect(parseBRL("0")).toBe(0);
  });
  it("accepte un ajustement négatif", () => {
    expect(parseBRL("-5,00")).toBe(-500);
  });
  it("rejette les saisies invalides", () => {
    expect(parseBRL("")).toBeNull();
    expect(parseBRL("abc")).toBeNull();
    expect(parseBRL("1,2,3")).toBeNull();
    expect(parseBRL("10,999")).toBeNull();
  });
  it("évite les erreurs de flottant", () => {
    expect(parseBRL("0,10")).toBe(10);
    expect(parseBRL("19,99")).toBe(1999);
  });
});

describe("centsToInput", () => {
  it("formate sans symbole", () => {
    expect(centsToInput(4990)).toBe("49,90");
    expect(centsToInput(5)).toBe("0,05");
    expect(centsToInput(-500)).toBe("-5,00");
    expect(parseBRL(centsToInput(123456))).toBe(123456);
  });
});

describe("slug", () => {
  it("normalise les accents et espaces", () => {
    expect(slugify("Cardápio Clássico")).toBe("cardapio-classico");
    expect(slugify("  Display 10 × 15 cm  ")).toBe("display-10-15-cm");
  });
  it("valide le format", () => {
    expect(isValidSlug("display-de-mesa")).toBe(true);
    expect(isValidSlug("Display")).toBe(false);
    expect(isValidSlug("a--b")).toBe(false);
    expect(isValidSlug("")).toBe(false);
  });
});
