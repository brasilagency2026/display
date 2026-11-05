import { ConvexError } from "convex/values";
import { isValidSlug } from "../../shared/slug";

/** Erreur lisible par le client (les Error simples sont masquées en production). */
export function fail(message: string): never {
  throw new ConvexError(message);
}

export function cleanText(value: string, label: string, max: number, required = true): string {
  const text = value.trim();
  if (required && text.length === 0) fail(`${label}: campo obrigatório.`);
  if (text.length > max) fail(`${label}: no máximo ${max} caracteres.`);
  return text;
}

export function optionalText(value: string | undefined, label: string, max: number): string | undefined {
  if (value === undefined) return undefined;
  const text = cleanText(value, label, max, false);
  return text === "" ? undefined : text;
}

export function assertInt(value: number, label: string, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    fail(`${label}: informe um número inteiro entre ${min} e ${max}.`);
  }
  return value;
}

export function assertSlug(slug: string): string {
  if (!isValidSlug(slug)) fail("Slug inválido: use letras minúsculas, números e hífens.");
  return slug;
}
