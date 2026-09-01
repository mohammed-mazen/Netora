import { execFileSync } from "node:child_process";
import { createServer as createHttpsServer } from "node:https";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { checkRouterHealth, disconnectRouterSession } from "./mikrotik";
import { createOrganizationForUser, createTenantRouter, createUserWithPassword } from "./db";
import { setRouterCredential } from "./secrets";

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@netora-test.local`;
}

function uniqueSlug(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

async function createTestRouter(prefix: string, overrides: Partial<{ connectionMode: "api_ssl" | "rest_https" | "agent"; managementAddress: string }> = {}) {
  const user = await createUserWithPassword({ email: uniqueEmail(prefix), passwordHash: "$2a$12$examplehashexamplehashexamplehashexamplehash" });
  const org = await createOrganizationForUser({ userId: user.id, name: `Test Org ${prefix}`, slug: uniqueSlug(prefix), timezone: "Asia/Riyadh", currency: "SAR" });
  const router = await createTenantRouter({
    organizationId: org.organizationId,
    name: `Router ${prefix}`,
    managementAddress: overrides.managementAddress ?? "10.255.255.1", // non-routable test address (TEST-NET reserved range-adjacent, guaranteed unreachable)
    connectionMode: overrides.connectionMode ?? "rest_https",
  });
  return { organizationId: org.organizationId, routerId: router.id };
}

describe("MikroTik RouterOS client (real network calls against unreachable/no-credential targets)", () => {
  it("refuses to run a health check when the router has no stored credentials", async () => {
    const { routerId } = await createTestRouter("no-cred");
    const result = await checkRouterHealth({ id: routerId, managementAddress: "10.255.255.1", connectionMode: "rest_https", credentialRef: null });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("لا توجد بيانات اعتماد");
  });

  it("refuses agent connectionMode outright since no local agent protocol is implemented", async () => {
    const result = await checkRouterHealth({ id: 1, managementAddress: "10.0.0.1", connectionMode: "agent", credentialRef: null });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("وكيلًا محليًا");
  });

  it("reports a connection failure (not a crash) when the router is unreachable, with credentials present", async () => {
    const { routerId } = await createTestRouter("unreachable");
    const credentialRef = await setRouterCredential(routerId, { username: "admin", password: "does-not-matter" });

    const result = await checkRouterHealth({ id: routerId, managementAddress: "10.255.255.1", connectionMode: "rest_https", credentialRef });
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  }, 15000);

  it("disconnectRouterSession also fails gracefully (not throws) without credentials", async () => {
    const result = await disconnectRouterSession(
      { id: 1, managementAddress: "10.0.0.1", connectionMode: "rest_https", credentialRef: null },
      { sessionIdentifier: "some-user", protocol: "hotspot" },
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("لا توجد بيانات اعتماد");
  });

  it("disconnectRouterSession reports failure (not throw) against an unreachable router", async () => {
    const { routerId } = await createTestRouter("disconnect-unreachable");
    const credentialRef = await setRouterCredential(routerId, { username: "admin", password: "irrelevant" });

    const result = await disconnectRouterSession(
      { id: routerId, managementAddress: "10.255.255.1", connectionMode: "rest_https", credentialRef },
      { sessionIdentifier: "customer1", protocol: "hotspot" },
    );
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  }, 15000);
});

// Real MikroTik routers serve their REST API over HTTPS with the RouterOS
// factory self-signed certificate (see the SECURITY TRADEOFF comment in
// mikrotik.ts). Node's native `fetch` rejects such a cert by default with
// UNABLE_TO_VERIFY_LEAF_SIGNATURE. This suite spins up a real local HTTPS
// server backed by a freshly-generated self-signed cert (via the system
// `openssl` binary — no network access needed) that mimics the two REST
// endpoints checkRouterHealth() calls, to prove the client actually connects
// through a self-signed cert end-to-end rather than merely failing fast on a
// timeout/connection-refused the way the unreachable-IP tests above do.
describe("MikroTik RouterOS client against a real self-signed-TLS REST server", () => {
  let server: ReturnType<typeof createHttpsServer>;
  let baseAddress: string;
  let certDir: string;

  beforeAll(async () => {
    certDir = mkdtempSync(join(tmpdir(), "netora-selfsigned-"));
    const keyPath = join(certDir, "key.pem");
    const certPath = join(certDir, "cert.pem");
    // Generate a throwaway self-signed cert, exactly like a factory-default
    // RouterOS device would have.
    execFileSync("openssl", [
      "req", "-x509", "-newkey", "rsa:2048", "-nodes",
      "-keyout", keyPath, "-out", certPath,
      "-days", "1", "-subj", "/CN=mikrotik-test-router",
    ], { stdio: "pipe" });
    const key = readFileSync(keyPath);
    const cert = readFileSync(certPath);

    server = createHttpsServer({ key, cert }, (req, res) => {
      const auth = req.headers.authorization;
      if (!auth || !auth.startsWith("Basic ")) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "unauthorized" }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      if (req.url === "/rest/system/identity") {
        res.end(JSON.stringify({ name: "test-mikrotik" }));
      } else if (req.url === "/rest/system/resource") {
        res.end(JSON.stringify({ version: "7.15", uptime: "1d2h3m4s", "cpu-load": "3" }));
      } else {
        res.end(JSON.stringify({}));
      }
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as AddressInfo;
    baseAddress = `127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    rmSync(certDir, { recursive: true, force: true });
  });

  it("successfully reads identity/resource through a self-signed TLS certificate (does not reject on UNABLE_TO_VERIFY_LEAF_SIGNATURE)", async () => {
    const user = await createUserWithPassword({ email: uniqueEmail("selfsigned"), passwordHash: "$2a$12$examplehashexamplehashexamplehashexamplehash" });
    const org = await createOrganizationForUser({ userId: user.id, name: "Test Org selfsigned", slug: uniqueSlug("selfsigned"), timezone: "Asia/Riyadh", currency: "SAR" });
    const router = await createTenantRouter({
      organizationId: org.organizationId,
      name: "Self-signed Router",
      managementAddress: baseAddress,
      connectionMode: "rest_https",
    });
    const credentialRef = await setRouterCredential(router.id, { username: "admin", password: "test-password" });

    const result = await checkRouterHealth({ id: router.id, managementAddress: baseAddress, connectionMode: "rest_https", credentialRef });

    expect(result.ok).toBe(true);
    expect(result.identity).toBe("test-mikrotik");
    expect(result.routerOsVersion).toBe("7.15");
    expect(result.cpuLoad).toBe(3);
  }, 15000);

  it("still enforces credential correctness (401) even with TLS verification relaxed", async () => {
    const user = await createUserWithPassword({ email: uniqueEmail("selfsigned-401"), passwordHash: "$2a$12$examplehashexamplehashexamplehashexamplehash" });
    const org = await createOrganizationForUser({ userId: user.id, name: "Test Org 401", slug: uniqueSlug("selfsigned-401"), timezone: "Asia/Riyadh", currency: "SAR" });
    const router = await createTenantRouter({
      organizationId: org.organizationId,
      name: "Self-signed Router 401",
      managementAddress: baseAddress,
      connectionMode: "rest_https",
    });
    // No credential stored at all -> handled before any network call.
    const result = await checkRouterHealth({ id: router.id, managementAddress: baseAddress, connectionMode: "rest_https", credentialRef: null });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("لا توجد بيانات اعتماد");
  });
});
