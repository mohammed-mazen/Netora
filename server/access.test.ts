import { describe, expect, it } from "vitest";
import { hasTenantPermission, redactAuditMetadata, tenantSelectorSchema } from "./access";

describe("tenant access policy", () => {
  it("keeps configuration writes exclusive to the appropriate tenant roles", () => {
    expect(hasTenantPermission("owner", "integrations:write")).toBe(true);
    expect(hasTenantPermission("manager", "integrations:write")).toBe(false);
    expect(hasTenantPermission("viewer", "network:write")).toBe(false);
    expect(hasTenantPermission("operator", "network:write")).toBe(true);
  });

  it("allows billing writes only to financial or administrative roles", () => {
    expect(hasTenantPermission("owner", "billing:write")).toBe(true);
    expect(hasTenantPermission("manager", "billing:write")).toBe(false);
    expect(hasTenantPermission("accountant", "billing:write")).toBe(true);
    expect(hasTenantPermission("support", "billing:write")).toBe(false);
    expect(hasTenantPermission("viewer", "billing:write")).toBe(false);
  });

  it("validates slugs and redacts credential-like audit fields", () => {
    expect(tenantSelectorSchema.safeParse({ organizationSlug: "north-network-01" }).success).toBe(true);
    expect(tenantSelectorSchema.safeParse({ organizationSlug: "North Network" }).success).toBe(false);
    expect(redactAuditMetadata({ secretRef: "do-not-log", event: "router.create" })).toContain("[REDACTED]");
    expect(redactAuditMetadata({ secretRef: "do-not-log", event: "router.create" })).not.toContain("do-not-log");
  });

  it("restricts alert policy writes and redacts nested secret references", () => {
    expect(hasTenantPermission("owner", "alerts:write")).toBe(true);
    expect(hasTenantPermission("manager", "alerts:write")).toBe(true);
    expect(hasTenantPermission("operator", "alerts:write")).toBe(false);
    expect(hasTenantPermission("viewer", "alerts:write")).toBe(false);
    const metadata = redactAuditMetadata({ integration: { secretRef: "secret://tenant/1/router" }, event: "alert_rule.save" });
    expect(metadata).toContain("[REDACTED]");
    expect(metadata).not.toContain("secret://tenant/1/router");
  });
});
