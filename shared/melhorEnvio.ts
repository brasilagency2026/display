// Client Melhor Envio — logique pure, sans dépendance à Convex, testable avec un fetch simulé.
// Sources : documentation officielle (docs.melhorenvio.com.br) :
//  - POST /api/v2/me/shipment/calculate (en-têtes Authorization Bearer, Accept, Content-Type, User-Agent « app (email) »)
//  - OAuth : /oauth/authorize (redirection navigateur) puis POST /oauth/token (authorization_code, refresh_token)
//  - jeton d'accès valable 30 jours, jeton de rafraîchissement 45 jours

import type { RawMelhorEnvioQuote } from "./shipping";

export type MelhorEnvioEnv = "sandbox" | "production";

export const BASE_URLS: Record<MelhorEnvioEnv, string> = {
  sandbox: "https://sandbox.melhorenvio.com.br",
  production: "https://melhorenvio.com.br",
};

/** Droits demandés : uniquement la cotation pour l'instant (à étendre quand les étiquettes seront gérées). */
export const QUOTE_SCOPES = ["shipping-calculate"] as const;

export const QUOTE_TTL_MS = 30 * 60 * 1000; // l'API ne fournit pas d'expiration : durée de validité propre
export const REFRESH_MARGIN_MS = 7 * 24 * 60 * 60 * 1000; // renouvellement préventif 7 jours avant l'expiration
export const MIN_TOKEN_VALIDITY_MS = 60 * 1000;

export function parseEnv(value: string | undefined): MelhorEnvioEnv {
  return value === "production" ? "production" : "sandbox";
}

export function buildUserAgent(appName: string, contactEmail: string): string {
  return `${appName.trim() || "Loja"} (${contactEmail.trim()})`;
}

/* --------------------------------- Cotation --------------------------------- */

export interface ShippingProduct {
  id: string;
  width: number; // cm
  height: number; // cm
  length: number; // cm
  weight: number; // kg
  insurance_value: number; // BRL
  quantity: number;
}

export function gramsToKg(grams: number): number {
  return Math.round(grams) / 1000;
}

export function buildCalculateBody(input: {
  originCep: string;
  destinationCep: string;
  products: ShippingProduct[];
}) {
  return {
    from: { postal_code: input.originCep },
    to: { postal_code: input.destinationCep },
    products: input.products,
    options: { receipt: false, own_hand: false },
  };
}

export interface HttpResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}
export type FetchFn = (
  url: string,
  init: { method: "POST"; headers: Record<string, string>; body: string },
) => Promise<HttpResponse>;

export type ErrorKind = "auth" | "validation" | "unavailable" | "unknown";

export class MelhorEnvioError extends Error {
  readonly kind: ErrorKind;
  constructor(message: string, kind: ErrorKind) {
    super(message);
    this.name = "MelhorEnvioError";
    this.kind = kind;
  }
}

async function safeJson(response: HttpResponse): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/** Appelle la cotation. Une nouvelle tentative est faite uniquement en cas d'indisponibilité (réseau, 5xx, 429). */
export async function calculateQuotes(options: {
  env: MelhorEnvioEnv;
  accessToken: string;
  userAgent: string;
  body: unknown;
  fetchFn: FetchFn;
  attempts?: number;
}): Promise<RawMelhorEnvioQuote[]> {
  const attempts = Math.max(1, options.attempts ?? 2);
  let last: MelhorEnvioError | null = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await options.fetchFn(`${BASE_URLS[options.env]}/api/v2/me/shipment/calculate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": options.userAgent,
        },
        body: JSON.stringify(options.body),
      });
      if (response.status === 401 || response.status === 403) {
        throw new MelhorEnvioError("Token do Melhor Envio inválido, sem permissão ou expirado.", "auth");
      }
      if (response.status === 422) {
        await safeJson(response);
        throw new MelhorEnvioError("Dados de cotação recusados (verifique os CEPs e as dimensões).", "validation");
      }
      if (!response.ok) {
        throw new MelhorEnvioError(`Melhor Envio indisponível (HTTP ${response.status}).`, "unavailable");
      }
      const data = await response.json();
      if (!Array.isArray(data)) throw new MelhorEnvioError("Resposta inesperada do Melhor Envio.", "unknown");
      return data as RawMelhorEnvioQuote[];
    } catch (error) {
      last =
        error instanceof MelhorEnvioError
          ? error
          : new MelhorEnvioError("Falha de rede ao consultar o Melhor Envio.", "unavailable");
      if (last.kind !== "unavailable") throw last;
    }
  }
  throw last ?? new MelhorEnvioError("Melhor Envio indisponível.", "unavailable");
}

/* ----------------------------------- OAuth ----------------------------------- */

export function authorizationUrl(input: {
  env: MelhorEnvioEnv;
  clientId: string;
  redirectUri: string;
  state: string;
  scopes: readonly string[];
}): string {
  const query = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    state: input.state,
    scope: input.scopes.join(" "),
  })
    .toString()
    .replace(/\+/g, "%20");
  return `${BASE_URLS[input.env]}/oauth/authorize?${query}`;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

/** Échange le code (authorization_code) ou renouvelle le jeton (refresh_token). Les routes OAuth ne prennent pas du JSON. */
export async function requestToken(options: {
  env: MelhorEnvioEnv;
  params: Record<string, string>;
  userAgent: string;
  fetchFn: FetchFn;
}): Promise<TokenResponse> {
  let response: HttpResponse;
  try {
    response = await options.fetchFn(`${BASE_URLS[options.env]}/oauth/token`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": options.userAgent,
      },
      body: new URLSearchParams(options.params).toString(),
    });
  } catch {
    throw new MelhorEnvioError("Falha de rede ao obter o token do Melhor Envio.", "unavailable");
  }
  if (!response.ok) {
    const kind: ErrorKind = response.status === 400 || response.status === 401 ? "auth" : "unavailable";
    throw new MelhorEnvioError(`Falha ao obter o token do Melhor Envio (HTTP ${response.status}).`, kind);
  }
  const data = (await safeJson(response)) as Record<string, unknown> | null;
  const accessToken = data?.access_token;
  const refreshToken = data?.refresh_token;
  const expiresIn = data?.expires_in;
  if (typeof accessToken !== "string" || typeof refreshToken !== "string" || typeof expiresIn !== "number") {
    throw new MelhorEnvioError("Resposta de token inesperada do Melhor Envio.", "unknown");
  }
  return { accessToken, refreshToken, expiresInSeconds: expiresIn };
}

/* ------------------------------ Cache et validité ----------------------------- */

/**
 * Empreinte d'une cotation : CEP + règles de frais + articles (identifiant produit/variante et quantité).
 * Le design n'entre pas dans l'empreinte : il ne change ni le poids ni les dimensions.
 */
export function quoteFingerprint(input: {
  cep: string;
  markupCents: number;
  enablePac: boolean;
  enableSedex: boolean;
  items: { productId: string; variantId?: string; quantity: number }[];
}): string {
  const lines = input.items.map((item) => `${item.productId}:${item.variantId ?? ""}:${item.quantity}`).sort();
  return [input.cep, input.markupCents, input.enablePac ? 1 : 0, input.enableSedex ? 1 : 0, ...lines].join("|");
}

/** Une cotation expirée doit être recalculée. */
export function isQuoteUsable(expiresAt: number, now: number): boolean {
  return now < expiresAt;
}

export function tokenNeedsRefresh(expiresAt: number, now: number, marginMs: number): boolean {
  return expiresAt - now <= marginMs;
}

/* ---------------------------------- Mode test --------------------------------- */

/** Réponse FICTIVE pour tester l'interface sans compte Melhor Envio. Jamais utilisée en production. */
export function mockQuotes(): RawMelhorEnvioQuote[] {
  return [
    { id: 1, name: "PAC", company: { name: "Correios" }, price: "18.50", custom_price: "18.50", delivery_time: 7, custom_delivery_time: 7 },
    { id: 2, name: "SEDEX", company: { name: "Correios" }, price: "32.10", custom_price: "32.10", delivery_time: 3, custom_delivery_time: 3 },
    { id: 3, name: ".Package", company: { name: "Jadlog" }, price: "15.00", custom_price: "15.00", delivery_time: 5, custom_delivery_time: 5 },
  ];
}
