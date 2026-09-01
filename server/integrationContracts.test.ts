import { describe, expect, it } from "vitest";
import { assertAllowedRouterOperation, validateIntegrationDraft } from "./integrationContracts";

describe("integration contracts", () => {
  it("accepts a MikroTik draft with a secret reference but no secret value", () => {
    expect(validateIntegrationDraft({ kind: "mikrotik", secretRef: "secret://tenant/42/router-main", configuration: { transport: "api_ssl", managementHost: "10.0.0.1" } }).secretRef).toContain("secret://");
  });

  it("rejects plaintext credentials and non-allowlisted operations", () => {
    expect(() => validateIntegrationDraft({ kind: "radius", configuration: { mode: "local", nasIdentifier: "nas-a", sharedSecret: "not-allowed" } })).toThrow("لا تقبل");
    expect(() => validateIntegrationDraft({ kind: "mikrotik", configuration: { transport: "api_ssl", managementHost: "router.local", transportOptions: { authToken: "not-allowed" } } })).toThrow("لا تقبل");
    expect(() => validateIntegrationDraft({ kind: "radius", secretRef: "shared-secret", configuration: { mode: "local", nasIdentifier: "nas-a" } })).toThrow("مرجع السر");
    expect(() => assertAllowedRouterOperation("system_reboot")).toThrow("غير مسموح");
  });
});
