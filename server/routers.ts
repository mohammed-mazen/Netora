import { systemRouter } from "./_core/systemRouter";
import { router } from "./_core/trpc";
import { authRouter } from "./routers/auth";
import { netoraRouter } from "./routers/netora";
import { tenantRouter } from "./routers/tenant";
import { workspaceRouter } from "./routers/workspace";
import { platformRouter } from "./routers/platform";
import { accountingRouter } from "./routers/accounting";
import { apiTokensRouter } from "./routers/apiTokens";
import { cardsRouter } from "./routers/cards";
import { rolesRouter } from "./routers/roles";
import { reportBuilderRouter } from "./routers/reportBuilder";
import { backupRouter } from "./routers/backup";
import { dynamicSettingsRouter } from "./routers/dynamicSettings";
import { hotspotPagesRouter } from "./routers/hotspotPages";
import { macSecurityRouter } from "./routers/macSecurity";
import { monitorRouter } from "./routers/monitor";
import { pointsRouter } from "./routers/points";
import { smsRouter } from "./routers/sms";
import { competitionsRouter } from "./routers/competitions";
import { chatRouter } from "./routers/chat";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: authRouter,
  netora: netoraRouter,
  tenant: tenantRouter,
  workspace: workspaceRouter,
  platform: platformRouter,

  // --- New fine-grained modules (competitive-parity rebuild) ---
  accounting: accountingRouter,
  apiTokens: apiTokensRouter,
  cards: cardsRouter,
  roles: rolesRouter,
  reportBuilder: reportBuilderRouter,
  backup: backupRouter,
  dynamicSettings: dynamicSettingsRouter,
  hotspotPages: hotspotPagesRouter,
  macSecurity: macSecurityRouter,
  monitor: monitorRouter,
  points: pointsRouter,
  sms: smsRouter,
  competitions: competitionsRouter,
  chat: chatRouter,
});

export type AppRouter = typeof appRouter;
