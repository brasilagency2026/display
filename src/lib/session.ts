// Identifiant anonyme du navigateur (cotations de frete, panier invité). Ne contient aucune donnée personnelle.
const KEY = "display.session.v1";
let memoryFallback: string | null = null;

export function getSessionRef(): string {
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(KEY, created);
    return created;
  } catch {
    memoryFallback ??= crypto.randomUUID();
    return memoryFallback;
  }
}
