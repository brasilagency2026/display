// Saisie et affichage des montants BRL, sans nombres flottants. Tout est en centavos.

/** « 49,90 », « R$ 1.234,56 », « 49.90 », « -5 » → centavos. null si la saisie est invalide. */
export function parseBRL(input: string): number | null {
  let text = input.replace(/R\$/gi, "").replace(/\s/g, "");
  if (!text) return null;
  let negative = false;
  if (text.startsWith("-")) {
    negative = true;
    text = text.slice(1);
  }
  if (!/^[\d.,]+$/.test(text)) return null;

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  let intPart: string;
  let decPart = "";

  if (lastComma >= 0) {
    const before = text.slice(0, lastComma);
    if (before.includes(",")) return null;
    intPart = before.replace(/\./g, "");
    decPart = text.slice(lastComma + 1);
  } else if (lastDot >= 0 && text.indexOf(".") === lastDot && text.length - lastDot - 1 <= 2) {
    intPart = text.slice(0, lastDot);
    decPart = text.slice(lastDot + 1);
  } else {
    intPart = text.replace(/\./g, "");
  }

  if (intPart === "") intPart = "0";
  if (!/^\d+$/.test(intPart)) return null;
  if (decPart !== "" && !/^\d{1,2}$/.test(decPart)) return null;

  const cents = Number(intPart) * 100 + Number(decPart.padEnd(2, "0") || "0");
  if (!Number.isSafeInteger(cents)) return null;
  return negative ? -cents : cents;
}

/** 4990 → « 49,90 » (valeur de champ de saisie, sans symbole). */
export function centsToInput(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}
