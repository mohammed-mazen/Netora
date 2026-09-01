import { describe, expect, it } from "vitest";
import {
  buildSecretRef,
  buildRouterSecretRef,
  resolveIntegrationSecret,
  resolveRouterCredential,
  setIntegrationSecret,
  setRouterCredential,
} from "./secrets";
import { createOrganizationForUser, createTenantRouter, createUserWithPassword } from "./db";

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@netora-test.local`;
}

function uniqueSlug(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

async function createTestOrganization(prefix: string) {
  const user = await createUserWithPassword({ email: uniqueEmail(prefix), passwordHash: "$2a$12$examplehashexamplehashexamplehashexamplehash" });
  const org = await createOrganizationForUser({ userId: user.id, name: `Test Org ${prefix}`, slug: uniqueSlug(prefix), timezone: "Asia/Riyadh", currency: "SAR" });
  return org.organizationId;
}

describe("secrets vault (AES-256-GCM, real DB round trip)", () => {
  it("encrypts and decrypts an org-level integration secret so the plaintext never round-trips through configuration storage", async () => {
    const organizationId = await createTestOrganization("integration");
    const secretRef = await setIntegrationSecret({ organizationId, kind: "radius", value: "super-secret-shared-key" });

    expect(secretRef).toBe(buildSecretRef(organizationId, "radius"));
    expect(secretRef).not.toContain("super-secret-shared-key");

    const resolved = await resolveIntegrationSecret(secretRef);
    expect(resolved).toBe("super-secret-shared-key");
  });

  it("replaces an existing integration secret on re-save (upsert by organization+kind)", async () => {
    const organizationId = await createTestOrganization("upsert");
    await setIntegrationSecret({ organizationId, kind: "mikrotik", value: "first-password" });
    const secretRef = await setIntegrationSecret({ organizationId, kind: "mikrotik", value: "second-password" });

    const resolved = await resolveIntegrationSecret(secretRef);
    expect(resolved).toBe("second-password");
  });

  it("returns null for a well-formed but unknown secretRef instead of throwing", async () => {
    const resolved = await resolveIntegrationSecret("secret://integration/999999999/mikrotik");
    expect(resolved).toBeNull();
  });

  it("rejects an empty secret value before it reaches the database", async () => {
    const organizationId = await createTestOrganization("empty");
    await expect(setIntegrationSecret({ organizationId, kind: "radius", value: "   " })).rejects.toThrow();
  });

  it("stores and resolves per-router credentials independently of the org-level integration secret", async () => {
    const organizationId = await createTestOrganization("router-cred");
    const router = await createTenantRouter({
      organizationId, name: "Test Router", managementAddress: "10.0.0.5", connectionMode: "rest_https",
    });

    const secretRef = await setRouterCredential(router.id, { username: "admin", password: "router-password-1" });
    expect(secretRef).toBe(buildRouterSecretRef(router.id));

    const resolved = await resolveRouterCredential(secretRef);
    expect(resolved).toEqual({ username: "admin", password: "router-password-1" });
  });

  it("allows two routers in the same organization to have independent credentials", async () => {
    const organizationId = await createTestOrganization("multi-router");
    const routerA = await createTenantRouter({ organizationId, name: "Router A", managementAddress: "10.0.1.1", connectionMode: "rest_https" });
    const routerB = await createTenantRouter({ organizationId, name: "Router B", managementAddress: "10.0.1.2", connectionMode: "rest_https" });

    await setRouterCredential(routerA.id, { username: "admin-a", password: "password-a" });
    await setRouterCredential(routerB.id, { username: "admin-b", password: "password-b" });

    expect(await resolveRouterCredential(buildRouterSecretRef(routerA.id))).toEqual({ username: "admin-a", password: "password-a" });
    expect(await resolveRouterCredential(buildRouterSecretRef(routerB.id))).toEqual({ username: "admin-b", password: "password-b" });
  });

  it("returns null when resolving a null/undefined/malformed router credential ref", async () => {
    expect(await resolveRouterCredential(null)).toBeNull();
    expect(await resolveRouterCredential(undefined)).toBeNull();
    expect(await resolveRouterCredential("not-a-valid-ref")).toBeNull();
    expect(await resolveRouterCredential("secret://router/999999999")).toBeNull();
  });

  it("rejects storing a router credential with an empty username or password", async () => {
    const organizationId = await createTestOrganization("invalid-cred");
    const router = await createTenantRouter({ organizationId, name: "Router C", managementAddress: "10.0.2.1", connectionMode: "rest_https" });
    await expect(setRouterCredential(router.id, { username: "   ", password: "x" })).rejects.toThrow();
    await expect(setRouterCredential(router.id, { username: "admin", password: "" })).rejects.toThrow();
  });
});
