import { describe, expect, it } from "vitest";
import {
  BASE_URLS,
  MelhorEnvioError,
  QUOTE_SCOPES,
  authorizationUrl,
  buildCalculateBody,
  buildUserAgent,
  calculateQuotes,
  gramsToKg,
  isQuoteUsable,
  mockQuotes,
  parseEnv,
  quoteFingerprint,
  requestToken,
  tokenNeedsRefresh,
} from "../shared/melhorEnvio";
import type { FetchFn, HttpResponse } from "../shared/melhorEnvio";
import { buildCustomerOptions } from "../shared/shipping";

const reply = (status: number, body: unknown): HttpResponse => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

interface Call {
  url: string;
  init: Parameters<FetchFn>[1];
}
function fakeFetch(responses: (HttpResponse | Error)[]): { fn: FetchFn; calls: Call[] } {
  const calls: Call[] = [];
  const fn: FetchFn = async (url, init) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (!next) throw new Error("plus de réponse simulée");
    if (next instanceof Error) throw next;
    return next;
  };
  return { fn, calls };
}

const base = { env: "sandbox" as const, accessToken: "TOKEN", userAgent: "Loja (contato@exemplo.com)", body: { a: 1 } };

describe("calculateQuotes", () => {
  it("appelle le bon endpoint avec les en-têtes documentés", async () => {
    const { fn, calls } = fakeFetch([reply(200, mockQuotes())]);
    const result = await calculateQuotes({ ...base, fetchFn: fn });
    expect(result).toHaveLength(3);
    expect(calls[0].url).toBe("https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate");
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.headers.Authorization).toBe("Bearer TOKEN");
    expect(calls[0].init.headers.Accept).toBe("application/json");
    expect(calls[0].init.headers["Content-Type"]).toBe("application/json");
    expect(calls[0].init.headers["User-Agent"]).toBe("Loja (contato@exemplo.com)");
  });

  it("utilise l'URL de production en production", async () => {
    const { fn, calls } = fakeFetch([reply(200, [])]);
    await calculateQuotes({ ...base, env: "production", fetchFn: fn });
    expect(calls[0].url).toBe("https://melhorenvio.com.br/api/v2/me/shipment/calculate");
  });

  it("signale un token refusé sans réessayer", async () => {
    const { fn, calls } = fakeFetch([reply(401, {}), reply(200, [])]);
    await expect(calculateQuotes({ ...base, fetchFn: fn })).rejects.toMatchObject({ kind: "auth" });
    expect(calls).toHaveLength(1);
  });

  it("signale une validation 422 sans réessayer", async () => {
    const { fn, calls } = fakeFetch([reply(422, { message: "invalid" }), reply(200, [])]);
    await expect(calculateQuotes({ ...base, fetchFn: fn })).rejects.toMatchObject({ kind: "validation" });
    expect(calls).toHaveLength(1);
  });

  it("réessaie une fois après une erreur 5xx puis réussit", async () => {
    const { fn, calls } = fakeFetch([reply(503, {}), reply(200, mockQuotes())]);
    expect(await calculateQuotes({ ...base, fetchFn: fn })).toHaveLength(3);
    expect(calls).toHaveLength(2);
  });

  it("réessaie après une erreur réseau puis abandonne", async () => {
    const { fn, calls } = fakeFetch([new Error("réseau"), new Error("réseau")]);
    await expect(calculateQuotes({ ...base, fetchFn: fn })).rejects.toBeInstanceOf(MelhorEnvioError);
    expect(calls).toHaveLength(2);
  });

  it("rejette une réponse qui n'est pas une liste", async () => {
    const { fn } = fakeFetch([reply(200, { message: "ok" })]);
    await expect(calculateQuotes({ ...base, fetchFn: fn })).rejects.toMatchObject({ kind: "unknown" });
  });
});

describe("filtrage PAC / SEDEX sur la réponse simulée", () => {
  it("ne garde que Correios PAC et SEDEX, supplément appliqué une fois", () => {
    const options = buildCustomerOptions(mockQuotes(), { markupCents: 500, enablePac: true, enableSedex: true });
    expect(options.map((o) => o.service)).toEqual(["PAC", "SEDEX"]);
    expect(options[0].customerPriceCents).toBe(2350);
    expect(options[1].customerPriceCents).toBe(3710);
  });
});

describe("corps de requête", () => {
  it("construit le corps documenté", () => {
    const body = buildCalculateBody({
      originCep: "01001000",
      destinationCep: "20040020",
      products: [{ id: "p1", width: 15, height: 3, length: 20, weight: gramsToKg(150), insurance_value: 0, quantity: 2 }],
    });
    expect(body.from.postal_code).toBe("01001000");
    expect(body.to.postal_code).toBe("20040020");
    expect(body.products[0].weight).toBe(0.15);
    expect(body.options).toEqual({ receipt: false, own_hand: false });
  });
  it("convertit les grammes en kg sans artefact", () => {
    expect(gramsToKg(1)).toBe(0.001);
    expect(gramsToKg(1250)).toBe(1.25);
  });
  it("forme le User-Agent « application (email) »", () => {
    expect(buildUserAgent("Minha Loja", "suporte@exemplo.com")).toBe("Minha Loja (suporte@exemplo.com)");
  });
});

describe("OAuth", () => {
  it("construit l'URL d'autorisation avec les droits séparés par un espace", () => {
    const url = authorizationUrl({
      env: "sandbox",
      clientId: "123",
      redirectUri: "https://x.convex.site/melhorenvio/callback",
      state: "abc",
      scopes: QUOTE_SCOPES,
    });
    expect(url.startsWith(`${BASE_URLS.sandbox}/oauth/authorize?`)).toBe(true);
    expect(url).toContain("client_id=123");
    expect(url).toContain("response_type=code");
    expect(url).toContain("state=abc");
    expect(url).toContain("scope=shipping-calculate");
    expect(url).toContain("redirect_uri=https%3A%2F%2Fx.convex.site%2Fmelhorenvio%2Fcallback");
  });

  it("encode plusieurs droits avec %20", () => {
    const url = authorizationUrl({ env: "production", clientId: "1", redirectUri: "https://a.b/c", state: "s", scopes: ["a", "b"] });
    expect(url).toContain("scope=a%20b");
    expect(url.startsWith("https://melhorenvio.com.br/oauth/authorize?")).toBe(true);
  });

  it("échange un code en x-www-form-urlencoded", async () => {
    const { fn, calls } = fakeFetch([reply(200, { token_type: "Bearer", expires_in: 2592000, access_token: "A", refresh_token: "R" })]);
    const token = await requestToken({
      env: "sandbox",
      params: { grant_type: "authorization_code", client_id: "1", client_secret: "S", redirect_uri: "https://a.b/c", code: "CODE" },
      userAgent: "Loja (a@b.com)",
      fetchFn: fn,
    });
    expect(token).toEqual({ accessToken: "A", refreshToken: "R", expiresInSeconds: 2592000 });
    expect(calls[0].url).toBe("https://sandbox.melhorenvio.com.br/oauth/token");
    expect(calls[0].init.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(calls[0].init.body).toContain("grant_type=authorization_code");
    expect(calls[0].init.body).toContain("code=CODE");
  });

  it("refuse une réponse de token incomplète ou une erreur", async () => {
    const a = fakeFetch([reply(200, { access_token: "A" })]);
    await expect(requestToken({ env: "sandbox", params: {}, userAgent: "x", fetchFn: a.fn })).rejects.toMatchObject({ kind: "unknown" });
    const b = fakeFetch([reply(400, {})]);
    await expect(requestToken({ env: "sandbox", params: {}, userAgent: "x", fetchFn: b.fn })).rejects.toMatchObject({ kind: "auth" });
  });
});

describe("cache, expiration et mode test", () => {
  const items = [{ productId: "p1", variantId: "v1", quantity: 2 }];
  const config = { cep: "20040020", markupCents: 500, enablePac: true, enableSedex: true };

  it("produit une empreinte stable, indépendante de l'ordre", () => {
    const a = quoteFingerprint({ ...config, items: [{ productId: "p1", quantity: 1 }, { productId: "p2", quantity: 3 }] });
    const b = quoteFingerprint({ ...config, items: [{ productId: "p2", quantity: 3 }, { productId: "p1", quantity: 1 }] });
    expect(a).toBe(b);
  });
  it("change l'empreinte si le supplément, le CEP ou les quantités changent", () => {
    const ref = quoteFingerprint({ ...config, items });
    expect(quoteFingerprint({ ...config, markupCents: 800, items })).not.toBe(ref);
    expect(quoteFingerprint({ ...config, cep: "01001000", items })).not.toBe(ref);
    expect(quoteFingerprint({ ...config, items: [{ ...items[0], quantity: 3 }] })).not.toBe(ref);
    expect(quoteFingerprint({ ...config, enableSedex: false, items })).not.toBe(ref);
  });
  it("considère une cotation expirée comme inutilisable", () => {
    expect(isQuoteUsable(1000, 999)).toBe(true);
    expect(isQuoteUsable(1000, 1000)).toBe(false);
    expect(isQuoteUsable(1000, 2000)).toBe(false);
  });
  it("décide du renouvellement du token", () => {
    const day = 86_400_000;
    expect(tokenNeedsRefresh(10 * day, 0, 7 * day)).toBe(false);
    expect(tokenNeedsRefresh(6 * day, 0, 7 * day)).toBe(true);
    expect(tokenNeedsRefresh(-1, 0, 7 * day)).toBe(true);
  });
  it("parseEnv n'active la production que si c'est demandé explicitement", () => {
    expect(parseEnv(undefined)).toBe("sandbox");
    expect(parseEnv("prod")).toBe("sandbox");
    expect(parseEnv("production")).toBe("production");
  });
});
