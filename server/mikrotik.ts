// Real MikroTik RouterOS API client (REST-over-HTTPS transport).
//
// Why REST-HTTPS and not the binary API-SSL protocol: RouterOS v7+ ships a
// built-in REST API (enable with `/ip service set www-ssl disabled=no` and
// `/rest` requires it). It is a plain HTTP(S) interface with HTTP Basic Auth,
// which Node's native `fetch` can talk to directly with zero extra
// dependencies — a good fit for a Workers-adjacent / lightweight VPS runtime.
// The legacy binary API (port 8728/8729) requires implementing MikroTik's
// custom length-prefixed binary framing and challenge-response auth, which is
// significantly more code and fragile to maintain; it is intentionally out of
// scope for this MVP. Routers configured with connectionMode="api_ssl" are
// still accepted by the schema (for forward-compatibility / documentation of
// intent) but are executed via the same REST transport here since RouterOS
// v7's REST API is served on the same HTTPS API-SSL certificate/port model in
// practice, on the standard REST path. If a user's fleet is RouterOS v6-only
// (no REST support), health checks will fail with a clear error explaining
// the required RouterOS version — see `runRouterOperation`'s error message.
//
// Every request is bounded by MIKROTIK_REQUEST_TIMEOUT_MS to avoid a hung
// router stalling the background worker.

import { Agent } from "undici";
import { resolveRouterCredential } from "./secrets";
import { MikrotikApiSslClient } from "./mikrotik_api";
import { validateExternalTarget, parseRouterEndpoint } from "./ssrfValidator";
import { buildRouterCommand, type MonitorAction } from "./monitorActions";

const REQUEST_TIMEOUT_MS = 8000;

// MikroTik routers almost always run with the factory self-signed TLS
// certificate on their REST-HTTPS (www-ssl) service — real ISP deployments
// rarely bother issuing a CA-signed cert for LAN/VPN-only management
// endpoints. Node's native `fetch` validates certs strictly by default and
// throws `UNABLE_TO_VERIFY_LEAF_SIGNATURE` against such a cert, which would
// make this client unusable against essentially every real router out there.
//
// SECURITY TRADEOFF: we disable certificate verification (not hostname
// verification alone — full verification) specifically for router management
// connections via a dedicated undici Agent passed as the fetch `dispatcher`.
// This is an intentional, scoped exception: router management traffic is
// expected to run over a LAN or a site-to-site/VPN tunnel, never bare over
// the public internet, and the alternative (requiring every operator to
// provision a real CA cert on every router) is impractical for an ISP
// managing potentially hundreds of field devices. Credentials are still sent
// over an encrypted TLS channel (just not an *authenticated* one), so this
// does not downgrade to plaintext — it only removes protection against an
// active man-in-the-middle on the management network itself.
// Not currently configurable per-router; if a future tenant needs strict
// verification (e.g. a router reachable over the public internet with a
// proper cert), this would need to become a per-router opt-in flag.
const insecureRouterAgent = new Agent({ connect: { rejectUnauthorized: process.env.NODE_ENV === "production" } });

export type MikrotikHealthResult = {
  ok: boolean;
  identity?: string;
  routerOsVersion?: string;
  uptime?: string;
  cpuLoad?: number;
  error?: string;
};

type RouterTarget = {
  id: number;
  managementAddress: string;
  connectionMode: "api_ssl" | "rest_https" | "agent";
  credentialRef: string | null;
};

async function buildRestUrl(managementAddress: string, path: string): Promise<string> {
  const hostWithPort = managementAddress.includes("://") ? managementAddress.replace(/^https?:\/\//, "") : managementAddress;
  const parsed = parseRouterEndpoint(hostWithPort, 443);

  // Disable strict target validation during unit tests to allow testing against 127.0.0.1
  if (process.env.NODE_ENV !== "test") {
    await validateExternalTarget(parsed.hostname);
  }

  const hostAndPort = parsed.port === 443 ? parsed.hostname : `${parsed.hostname}:${parsed.port}`;
  return `https://${hostAndPort}/rest${path}`;
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, dispatcher: insecureRouterAgent } as RequestInit);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Executes a real health check + identity read against a MikroTik router via
 * its REST API. Returns a structured result rather than throwing, so the
 * background worker can persist a meaningful `lastError` without crashing
 * the job loop.
 */
export async function checkRouterHealth(router: RouterTarget): Promise<MikrotikHealthResult> {
  if (router.connectionMode === "agent") {
    return { ok: false, error: "connectionMode=agent يتطلب وكيلًا محليًا غير مطبق بعد؛ استخدم api_ssl أو rest_https" };
  }

  const credential = await resolveRouterCredential(router.credentialRef);
  if (!credential) {
    return { ok: false, error: "لا توجد بيانات اعتماد محفوظة لهذا الراوتر — أضف اسم المستخدم وكلمة المرور أولاً" };
  }

  const authHeader = `Basic ${Buffer.from(`${credential.username}:${credential.password}`).toString("base64")}`;

  try {
    const url = await buildRestUrl(router.managementAddress, "/system/identity");
    const identityRes = await fetchWithTimeout(url, {
      method: "GET",
      headers: { Authorization: authHeader, Accept: "application/json" },
    });
    if (identityRes.status === 401 || identityRes.status === 403) {
      return { ok: false, error: "فشل التحقق من بيانات الاعتماد (401/403) — تأكد من اسم المستخدم وكلمة المرور" };
    }
    if (!identityRes.ok) {
      return { ok: false, error: `تعذر الوصول إلى REST API الخاص بالراوتر (HTTP ${identityRes.status}) — تأكد أن RouterOS v7+ مع REST مفعّل` };
    }
    const identityBody = (await identityRes.json()) as { name?: string };

    const resUrl = await buildRestUrl(router.managementAddress, "/system/resource");
    const resourceRes = await fetchWithTimeout(resUrl, {
      method: "GET",
      headers: { Authorization: authHeader, Accept: "application/json" },
    });
    let routerOsVersion: string | undefined;
    let uptime: string | undefined;
    let cpuLoad: number | undefined;
    if (resourceRes.ok) {
      const resourceBody = (await resourceRes.json()) as { version?: string; uptime?: string; ["cpu-load"]?: string | number };
      routerOsVersion = resourceBody.version;
      uptime = resourceBody.uptime;
      const rawLoad = resourceBody["cpu-load"];
      cpuLoad = rawLoad !== undefined ? Number(rawLoad) : undefined;
    }

    return { ok: true, identity: identityBody.name, routerOsVersion, uptime, cpuLoad };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: `انتهت مهلة الاتصال بالراوتر (${REQUEST_TIMEOUT_MS}ms) — تحقق من الشبكة/الجدار الناري` };
    }
    const message = error instanceof Error ? error.message : "خطأ غير معروف أثناء الاتصال بالراوتر";
    return { ok: false, error: `تعذر الاتصال بالراوتر: ${message}` };
  }
}

/**
 * Forces a RADIUS/hotspot/PPPoE session off a router by name (best effort).
 * Tries both hotspot active and PPPoE active tables since a session's exact
 * protocol may not always be reliably known at call time.
 */
export async function disconnectRouterSession(
  router: RouterTarget,
  input: { sessionIdentifier: string; protocol: "hotspot" | "pppoe" },
): Promise<{ ok: boolean; error?: string }> {
  const credential = await resolveRouterCredential(router.credentialRef);
  if (!credential) {
    return { ok: false, error: "لا توجد بيانات اعتماد محفوظة لهذا الراوتر" };
  }

  const listPath = input.protocol === "hotspot" ? "/ip/hotspot/active" : "/ppp/active";

  if (router.connectionMode === "api_ssl") {
     const hostWithPort = router.managementAddress.includes("://") ? router.managementAddress.replace(/^https?:\/\//, "") : router.managementAddress;
     const parsed = parseRouterEndpoint(hostWithPort, 8729);

     if (process.env.NODE_ENV !== "test") {
       await validateExternalTarget(parsed.hostname);
     }

     const hostOnly = parsed.hostname;
     const port = parsed.port;

     const client = new MikrotikApiSslClient(hostOnly, port, REQUEST_TIMEOUT_MS);
     try {
         await client.connect();
         await client.login(credential.username, credential.password);

         const cmdPath = listPath + "/print";
         const entries = await client.execute(cmdPath);

         const match = entries.find(entry => entry.user === input.sessionIdentifier || entry.name === input.sessionIdentifier || entry["mac-address"] === input.sessionIdentifier);
         if (!match || !match[".id"]) {
             client.disconnect();
             return { ok: false, error: "لم يتم العثور على جلسة نشطة مطابقة على الراوتر" };
         }

         const rmCmdPath = listPath + "/remove";
         await client.execute(rmCmdPath, { ".id": match[".id"] });
         client.disconnect();
         return { ok: true };
     } catch (error: any) {
         client.disconnect();
         if (error.message.includes("Timeout")) {
              return { ok: false, error: `انتهت مهلة الاتصال بالراوتر (${REQUEST_TIMEOUT_MS}ms)` };
         }
         return { ok: false, error: `تعذر قطع الجلسة: ${error.message}` };
     }
  }

  const authHeader = `Basic ${Buffer.from(`${credential.username}:${credential.password}`).toString("base64")}`;

  try {
    const listUrl = await buildRestUrl(router.managementAddress, listPath);
    const listRes = await fetchWithTimeout(listUrl, {
      method: "GET",
      headers: { Authorization: authHeader, Accept: "application/json" },
    });
    if (!listRes.ok) return { ok: false, error: `تعذر قراءة الجلسات النشطة (HTTP ${listRes.status})` };
    const entries = (await listRes.json()) as Array<Record<string, string>>;
    const match = entries.find(entry => entry.user === input.sessionIdentifier || entry.name === input.sessionIdentifier || entry["mac-address"] === input.sessionIdentifier);
    if (!match || !match[".id"]) return { ok: false, error: "لم يتم العثور على جلسة نشطة مطابقة على الراوتر" };

    const removeUrl = `${await buildRestUrl(router.managementAddress, listPath)}/${encodeURIComponent(match[".id"])}`;
    const removeRes = await fetchWithTimeout(removeUrl, {
      method: "DELETE",
      headers: { Authorization: authHeader },
    });
    if (!removeRes.ok && removeRes.status !== 404) return { ok: false, error: `فشل قطع الجلسة (HTTP ${removeRes.status})` };
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: `انتهت مهلة الاتصال بالراوتر (${REQUEST_TIMEOUT_MS}ms)` };
    }
    const message = error instanceof Error ? error.message : "خطأ غير معروف";
    return { ok: false, error: `تعذر قطع الجلسة: ${message}` };
  }
}

/**
 * Executes a server/router monitor action (reboot or shutdown) against a
 * MikroTik router via its REST API, driven by the pure command map in
 * server/monitorActions.ts. Returns a structured result (never throws) so the
 * background worker can persist a meaningful error onto monitorActionLogs.
 */
export async function runRouterSystemCommand(router: RouterTarget, action: MonitorAction): Promise<{ ok: boolean; error?: string }> {
  if (router.connectionMode === "agent") {
    return { ok: false, error: "connectionMode=agent يتطلب وكيلًا محليًا غير مطبق بعد؛ استخدم api_ssl أو rest_https" };
  }

  const credential = await resolveRouterCredential(router.credentialRef);
  if (!credential) {
    return { ok: false, error: "لا توجد بيانات اعتماد محفوظة لهذا الراوتر — أضف اسم المستخدم وكلمة المرور أولاً" };
  }

  const command = buildRouterCommand(action);

  if (router.connectionMode === "api_ssl") {
     const hostWithPort = router.managementAddress.includes("://") ? router.managementAddress.replace(/^https?:\/\//, "") : router.managementAddress;
     const parsed = parseRouterEndpoint(hostWithPort, 8729);

     if (process.env.NODE_ENV !== "test") {
       await validateExternalTarget(parsed.hostname);
     }

     const hostOnly = parsed.hostname;
     const port = parsed.port;

     const client = new MikrotikApiSslClient(hostOnly, port, REQUEST_TIMEOUT_MS);
     try {
         await client.connect();
         await client.login(credential.username, credential.password);

         await client.execute(command.path);

         client.disconnect();
         return { ok: true };
     } catch (error: any) {
         client.disconnect();
         if (error.message.includes("Timeout")) {
              return { ok: false, error: `انتهت مهلة الاتصال بالراوتر (${REQUEST_TIMEOUT_MS}ms) — تحقق من الشبكة/الجدار الناري` };
         }
         return { ok: false, error: `تعذر تنفيذ ${action} على الراوتر: ${error.message}` };
     }
  }

  const authHeader = `Basic ${Buffer.from(`${credential.username}:${credential.password}`).toString("base64")}`;

  try {
    const actionUrl = await buildRestUrl(router.managementAddress, command.path);
    const res = await fetchWithTimeout(actionUrl, {
      method: command.method,
      headers: { Authorization: authHeader, Accept: "application/json" },
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "فشل التحقق من بيانات الاعتماد (401/403) — تأكد من اسم المستخدم وكلمة المرور" };
    }
    if (res.status === 404) {
      return { ok: false, error: `العملية ${action} غير مدعومة على هذا الراوتر (HTTP 404) — تأكد أن RouterOS v7+ مع REST مفعّل` };
    }
    if (!res.ok) {
      return { ok: false, error: `فشل تنفيذ ${action} على الراوتر (HTTP ${res.status})` };
    }
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: `انتهت مهلة الاتصال بالراوتر (${REQUEST_TIMEOUT_MS}ms) — تحقق من الشبكة/الجدار الناري` };
    }
    const message = error instanceof Error ? error.message : "خطأ غير معروف";
    return { ok: false, error: `تعذر تنفيذ ${action} على الراوتر: ${message}` };
  }
}
