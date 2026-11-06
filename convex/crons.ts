import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Renouvelle le jeton Melhor Envio (valable 30 jours) bien avant son expiration.
crons.daily("renovar token do Melhor Envio", { hourUTC: 6, minuteUTC: 0 }, internal.melhorEnvio.refreshIfNeeded);

export default crons;
