// Real RADIUS accounting ingestion endpoint (Start/Interim-Update/Stop).
//
// Node is not a great fit for parsing raw RADIUS UDP packets (port 1813), so
// the supported VPS layout is:
//   freeradius --(linelog / rlm_rest / exec module)--> this HTTP endpoint
// FreeRADIUS's `rlm_rest` module (or a small `exec` shim) converts a real
// Accounting-Request into a JSON POST here. This endpoint:
//   1. Verifies a shared secret via the `X-Radius-Shared-Secret` header
//      (compared against the RADIUS integration's secret in the encrypted
//      vault, resolved via the request's NAS-Identifier -> router -> org).
//   2. Resolves which router (and therefore which tenant organization) sent
//      the event via its NAS-Identifier — accounting packets carry no tenant
//      context themselves, so NAS-Identifier must be unique per router
//      platform-wide (see server/db.ts's getRouterByNasIdentifier doc comment
//      and the deployment README for FreeRADIUS `clients.conf` setup notes).
//   3. Upserts the corresponding row in `network_sessions` via
//      applyRadiusAccountingEvent (Start creates, Interim-Update refreshes
//      counters, Stop closes and records final counters).
//
// Expected JSON body shape (produced by the FreeRADIUS shim):
// {
//   "nasIdentifier": "nas-branch-1",
//   "acctStatusType": "Start" | "Interim-Update" | "Stop",
//   "acctUniqueId": "...",           // RADIUS Acct-Unique-Session-Id
//   "username": "customer_username", // maps to customers.username (optional)
//   "protocol": "hotspot" | "pppoe",
//   "acctInputOctets": "12345",
//   "acctOutputOctets": "67890",
//   "eventTime": "2026-08-28T10:00:00.000Z"  // optional, defaults to now
// }
import type { Express } from "express";
import {
  applyRadiusAccountingEvent,
  findTenantCustomerByUsername,
  getRouterByNasIdentifier,
} from "./db";
import { resolveIntegrationSecret } from "./secrets";

type AccountingBody = {
  nasIdentifier?: unknown;
  acctStatusType?: unknown;
  acctUniqueId?: unknown;
  username?: unknown;
  protocol?: unknown;
  acctInputOctets?: unknown;
  acctOutputOctets?: unknown;
  eventTime?: unknown;
};

function normalizeStatusType(value: unknown): "start" | "interim-update" | "stop" | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "start") return "start";
  if (normalized === "interim-update" || normalized === "interim update" || normalized === "alive") return "interim-update";
  if (normalized === "stop") return "stop";
  return null;
}

function normalizeProtocol(value: unknown): "hotspot" | "pppoe" {
  return value === "pppoe" ? "pppoe" : "hotspot";
}

function normalizeOctets(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.max(0, Math.trunc(value)));
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return value.trim();
  return "0";
}

export function registerRadiusAccountingRoute(app: Express) {
  app.post("/api/radius/accounting", async (req, res) => {
    const body = req.body as AccountingBody;

    const nasIdentifier = typeof body.nasIdentifier === "string" ? body.nasIdentifier.trim() : "";
    const acctUniqueId = typeof body.acctUniqueId === "string" ? body.acctUniqueId.trim() : "";
    const statusType = normalizeStatusType(body.acctStatusType);

    if (!nasIdentifier || !acctUniqueId || !statusType) {
      res.status(400).json({ accepted: false, error: "nasIdentifier, acctUniqueId, acctStatusType مطلوبة" });
      return;
    }

    try {
      const router = await getRouterByNasIdentifier(nasIdentifier);
      if (!router) {
        res.status(404).json({ accepted: false, error: "لا يوجد راوتر مسجل بهذا NAS-Identifier" });
        return;
      }

      // Shared-secret verification: the RADIUS integration secret for this
      // router's organization must match the caller-supplied header. This
      // stops an arbitrary caller from injecting fake accounting events for
      // a tenant they don't control.
      const suppliedSecret = req.headers["x-radius-shared-secret"];
      const configuredSecretRef = `secret://integration/${router.organizationId}/radius`;
      const expectedSecret = await resolveIntegrationSecret(configuredSecretRef);
      if (expectedSecret) {
        if (typeof suppliedSecret !== "string" || suppliedSecret !== expectedSecret) {
          res.status(401).json({ accepted: false, error: "سر RADIUS المشترك غير صحيح أو مفقود" });
          return;
        }
      } else {
        console.warn(`[RadiusAccounting] no shared secret configured for org ${router.organizationId} — accepting unauthenticated event (configure the RADIUS integration secret to enforce verification)`);
      }

      const username = typeof body.username === "string" ? body.username.trim() : "";
      const customer = username ? await findTenantCustomerByUsername(router.organizationId, username) : null;

      const eventTime = typeof body.eventTime === "string" && !Number.isNaN(Date.parse(body.eventTime)) ? new Date(body.eventTime) : new Date();

      const result = await applyRadiusAccountingEvent({
        organizationId: router.organizationId,
        routerId: router.id,
        customerId: customer?.id ?? null,
        acctUniqueId,
        protocol: normalizeProtocol(body.protocol),
        statusType,
        inputOctets: normalizeOctets(body.acctInputOctets),
        outputOctets: normalizeOctets(body.acctOutputOctets),
        eventTime,
      });

      res.status(202).json({ accepted: true, sessionId: result.id, action: result.action });
    } catch (error) {
      console.error("[RadiusAccounting] failed to process event:", error);
      res.status(500).json({ accepted: false, error: "تعذر معالجة حدث RADIUS" });
    }
  });
}
