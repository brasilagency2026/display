const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Formate des centavos en "R$ 129,90". */
export function formatBRL(cents: number): string {
  return brl.format(cents / 100);
}

export function formatDate(timestampMs: number): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(timestampMs);
}

export function formatCEP(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}
