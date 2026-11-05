import { ConvexError } from "convex/values";

/** Message lisible : les ConvexError du backend portent un texte PT-BR ; le reste reste générique. */
export function errorMessage(error: unknown, fallback = "Não foi possível concluir a ação. Tente novamente."): string {
  if (error instanceof ConvexError && typeof error.data === "string") return error.data;
  return fallback;
}
