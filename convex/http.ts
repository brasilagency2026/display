import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

/**
 * Retour de l'autorisation OAuth Melhor Envio (redirect_uri enregistrée dans l'application Melhor Envio).
 * Le « state » est à usage unique et lié à l'administrateur qui a lancé la connexion.
 */
http.route({
  path: "/melhorenvio/callback",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const siteUrl = process.env.SITE_URL ?? "";

    const back = (result: "ok" | "erro") =>
      siteUrl
        ? new Response(null, { status: 302, headers: { Location: `${siteUrl}/admin/configuracoes?melhorenvio=${result}` } })
        : new Response(result === "ok" ? "Melhor Envio conectado." : "Falha na conexão com o Melhor Envio.", { status: 200 });

    if (url.searchParams.get("error") || !code || !state) return back("erro");
    const actorUserId = await ctx.runMutation(internal.melhorEnvio.consumeState, { state });
    if (!actorUserId) return back("erro");
    const ok = await ctx.runAction(internal.melhorEnvio.completeAuthorization, { code, actorUserId });
    return back(ok ? "ok" : "erro");
  }),
});

// Les webhooks Mercado Pago / Mercado Livre seront ajoutés ici (phases suivantes).

export default http;
