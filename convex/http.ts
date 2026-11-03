import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

// Les webhooks Mercado Pago / Mercado Livre seront ajoutés ici (phases 4 et 7).

export default http;
