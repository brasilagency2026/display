import { ConvexError, v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { requireAdmin } from "./access";
import { audit } from "./lib/audit";
import { DEFAULT_STORE, readSetting } from "./lib/settings";
import { fail } from "./lib/validate";
import {
  MIN_TOKEN_VALIDITY_MS,
  MelhorEnvioError,
  QUOTE_SCOPES,
  REFRESH_MARGIN_MS,
  authorizationUrl,
  buildUserAgent,
  parseEnv,
  requestToken,
  tokenNeedsRefresh,
} from "../shared/melhorEnvio";
import type { FetchFn, MelhorEnvioEnv } from "../shared/melhorEnvio";

// Secrets (variables d'environnement Convex, jamais dans le dépôt ni le navigateur) :
//   MELHOR_ENVIO_CLIENT_ID, MELHOR_ENVIO_CLIENT_SECRET
//   MELHOR_ENVIO_ENV = sandbox | production   (défaut : sandbox)
//   SHIPPING_MOCK = true                      (cotation FICTIVE, ignorée en production)

const STATE_TTL_MS = 10 * 60 * 1000;

export const realFetch: FetchFn = (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });

export function melhorEnvioConfig() {
  return {
    env: parseEnv(process.env.MELHOR_ENVIO_ENV),
    clientId: process.env.MELHOR_ENVIO_CLIENT_ID ?? "",
    clientSecret: process.env.MELHOR_ENVIO_CLIENT_SECRET ?? "",
    siteUrl: process.env.CONVEX_SITE_URL ?? "",
  };
}

/** Le mode fictif n'est jamais actif en production Melhor Envio. */
export function mockEnabled(): boolean {
  return process.env.SHIPPING_MOCK === "true" && melhorEnvioConfig().env !== "production";
}

function redirectUri(): string {
  const { siteUrl } = melhorEnvioConfig();
  return siteUrl ? `${siteUrl}/melhorenvio/callback` : "";
}

/* ------------------------------- Accès internes ------------------------------- */

export const getTokenRow = internalQuery({
  args: {},
  handler: async (ctx) =>
    ctx.db
      .query("integrationTokens")
      .withIndex("by_provider", (q) => q.eq("provider", "melhor_envio"))
      .first(),
});

/** User-Agent exigé par l'API : nom de l'application + e-mail de contact de la boutique (jamais celui d'un compte personnel). */
export const getUserAgent = internalQuery({
  args: {},
  handler: async (ctx): Promise<string | null> => {
    const store = await readSetting(ctx, "store", DEFAULT_STORE);
    return store.contactEmail ? buildUserAgent(store.storeName || "Loja de displays", store.contactEmail) : null;
  },
});

export const saveToken = internalMutation({
  args: {
    environment: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
    scope: v.optional(v.string()),
    actorUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const { actorUserId, ...fields } = args;
    const existing = await ctx.db
      .query("integrationTokens")
      .withIndex("by_provider", (q) => q.eq("provider", "melhor_envio"))
      .first();
    const row = { ...fields, provider: "melhor_envio" as const, updatedAt: Date.now() };
    if (existing) await ctx.db.patch(existing._id, row);
    else await ctx.db.insert("integrationTokens", row);
    if (actorUserId) await audit(ctx, actorUserId, "integration.melhorenvio.connect", "integration", "melhor_envio", { environment: args.environment });
  },
});

/* ----------------------------- Autorisation OAuth ----------------------------- */

export const createState = internalMutation({
  args: { state: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    await ctx.db.insert("oauthStates", {
      provider: "melhor_envio",
      state: args.state,
      createdBy: admin._id,
      expiresAt: Date.now() + STATE_TTL_MS,
    });
  },
});

/** Usage unique : le state est supprimé dès qu'il est lu. Retourne l'administrateur qui a lancé la connexion. */
export const consumeState = internalMutation({
  args: { state: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("oauthStates")
      .withIndex("by_state", (q) => q.eq("state", args.state))
      .first();
    if (!row) return null;
    await ctx.db.delete(row._id);
    return row.expiresAt > Date.now() ? row.createdBy : null;
  },
});

function randomState(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Démarre la connexion : retourne l'URL d'autorisation Melhor Envio (le navigateur y est redirigé). */
export const startAuthorization = action({
  args: {},
  handler: async (ctx): Promise<string> => {
    const config = melhorEnvioConfig();
    if (!config.clientId || !config.clientSecret) {
      fail("Defina MELHOR_ENVIO_CLIENT_ID e MELHOR_ENVIO_CLIENT_SECRET nos segredos do Convex.");
    }
    if (!redirectUri()) fail("URL do backend indisponível (CONVEX_SITE_URL).");
    const state = randomState();
    await ctx.runMutation(internal.melhorEnvio.createState, { state }); // vérifie aussi le rôle admin
    return authorizationUrl({
      env: config.env,
      clientId: config.clientId,
      redirectUri: redirectUri(),
      state,
      scopes: QUOTE_SCOPES,
    });
  },
});

/** Échange le code d'autorisation contre les jetons et les enregistre. Retourne true en cas de succès. */
export const completeAuthorization = internalAction({
  args: { code: v.string(), actorUserId: v.id("users") },
  handler: async (ctx, args): Promise<boolean> => {
    const config = melhorEnvioConfig();
    const userAgent = await ctx.runQuery(internal.melhorEnvio.getUserAgent, {});
    if (!userAgent || !config.clientId || !config.clientSecret) return false;
    try {
      const token = await requestToken({
        env: config.env,
        params: {
          grant_type: "authorization_code",
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: redirectUri(),
          code: args.code,
        },
        userAgent,
        fetchFn: realFetch,
      });
      await ctx.runMutation(internal.melhorEnvio.saveToken, {
        environment: config.env,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        expiresAt: Date.now() + token.expiresInSeconds * 1000,
        scope: QUOTE_SCOPES.join(" "),
        actorUserId: args.actorUserId,
      });
      return true;
    } catch (error) {
      console.error("Melhor Envio: échec de l'autorisation", error instanceof MelhorEnvioError ? error.kind : "unknown");
      return false;
    }
  },
});

/* ------------------------------ Jeton d'accès valide --------------------------- */

async function refresh(ctx: ActionCtx, row: Doc<"integrationTokens">, env: MelhorEnvioEnv): Promise<string> {
  const config = melhorEnvioConfig();
  const userAgent = await ctx.runQuery(internal.melhorEnvio.getUserAgent, {});
  if (!userAgent) throw new ConvexError("Configure o e-mail de contato da loja em Configurações.");
  try {
    const token = await requestToken({
      env,
      params: {
        grant_type: "refresh_token",
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: row.refreshToken,
      },
      userAgent,
      fetchFn: realFetch,
    });
    await ctx.runMutation(internal.melhorEnvio.saveToken, {
      environment: env,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken, // le jeton de rafraîchissement est remplacé à chaque renouvellement
      expiresAt: Date.now() + token.expiresInSeconds * 1000,
      scope: row.scope,
    });
    return token.accessToken;
  } catch {
    // Un renouvellement concurrent a peut-être déjà réussi : on relit avant de conclure à un échec.
    const fresh = await ctx.runQuery(internal.melhorEnvio.getTokenRow, {});
    if (fresh && fresh.refreshToken !== row.refreshToken && fresh.expiresAt - Date.now() > MIN_TOKEN_VALIDITY_MS) {
      return fresh.accessToken;
    }
    throw new ConvexError("O Melhor Envio precisa ser reconectado (token expirado).");
  }
}

/** Retourne un jeton d'accès valide, en le renouvelant si nécessaire. */
export async function ensureAccessToken(ctx: ActionCtx): Promise<{ accessToken: string; env: MelhorEnvioEnv }> {
  const { env } = melhorEnvioConfig();
  const row = await ctx.runQuery(internal.melhorEnvio.getTokenRow, {});
  if (!row) throw new ConvexError("O Melhor Envio ainda não foi conectado.");
  if (row.environment !== env) throw new ConvexError("O ambiente do Melhor Envio mudou. Reconecte a conta.");
  if (!tokenNeedsRefresh(row.expiresAt, Date.now(), MIN_TOKEN_VALIDITY_MS)) {
    return { accessToken: row.accessToken, env };
  }
  return { accessToken: await refresh(ctx, row, env), env };
}

/** Tâche quotidienne : renouvelle le jeton 7 jours avant l'expiration pour que l'intégration ne s'arrête jamais. */
export const refreshIfNeeded = internalAction({
  args: {},
  handler: async (ctx): Promise<void> => {
    const row = await ctx.runQuery(internal.melhorEnvio.getTokenRow, {});
    if (!row) return;
    if (!tokenNeedsRefresh(row.expiresAt, Date.now(), REFRESH_MARGIN_MS)) return;
    try {
      await refresh(ctx, row, parseEnv(row.environment));
    } catch {
      console.error("Melhor Envio: renouvellement préventif du token impossible.");
    }
  },
});

/* --------------------------------- Statut admin -------------------------------- */

export const status = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const config = melhorEnvioConfig();
    const row = await ctx.db
      .query("integrationTokens")
      .withIndex("by_provider", (q) => q.eq("provider", "melhor_envio"))
      .first();
    const store = await readSetting(ctx, "store", DEFAULT_STORE);
    // Jamais de jeton ni de secret dans la réponse : uniquement des indicateurs.
    return {
      environment: config.env,
      credentialsConfigured: Boolean(config.clientId && config.clientSecret),
      contactEmailConfigured: Boolean(store.contactEmail),
      connected: row !== null && row.environment === config.env,
      tokenExpiresAt: row?.expiresAt ?? null,
      mock: mockEnabled(),
      redirectUri: redirectUri() || null,
    };
  },
});
