import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function userWithoutMembership(): TrpcContext {
  return {
    user: {
      id: 9_999_991,
      name: "مستخدم عزل",
      email: "isolation@netora.local",
      passwordHash: "$2a$12$examplehashexamplehashexamplehashexamplehash",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: { "x-request-id": "tenant-isolation-test" } } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("tenant procedure isolation", () => {
  it("rejects an overview request for an organization not present in the user's active memberships", async () => {
    const caller = appRouter.createCaller(userWithoutMembership());
    await expect(caller.tenant.overview({ organizationSlug: "other-tenant" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects a network query before any organization-scoped data is evaluated", async () => {
    const caller = appRouter.createCaller(userWithoutMembership());
    await expect(caller.workspace.network.listRouters({ organizationSlug: "other-tenant", limit: 25, offset: 0 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects a session-disconnect request before it can enqueue a tenant job", async () => {
    const caller = appRouter.createCaller(userWithoutMembership());
    await expect(caller.workspace.sessions.queueDisconnect({ organizationSlug: "other-tenant", sessionId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects a customer status filter before it can evaluate data for another organization", async () => {
    const caller = appRouter.createCaller(userWithoutMembership());
    await expect(caller.workspace.customers.list({ organizationSlug: "other-tenant", limit: 25, offset: 0, status: "blocked" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects filtered operational lists before reading another organization's data", async () => {
    const caller = appRouter.createCaller(userWithoutMembership());
    await expect(caller.workspace.sessions.list({ organizationSlug: "other-tenant", limit: 25, offset: 0, state: "active", search: "nas-a" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.workspace.vouchers.listBatches({ organizationSlug: "other-tenant", limit: 25, offset: 0, status: "printed", search: "VCH-" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.workspace.billing.listInvoices({ organizationSlug: "other-tenant", limit: 25, offset: 0, status: "paid", search: "INV-" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.workspace.support.list({ organizationSlug: "other-tenant", limit: 25, offset: 0, status: "open", search: "SUP-" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.workspace.support.updateStatus({ organizationSlug: "other-tenant", ticketId: 1, status: "closed" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.workspace.audit.list({ organizationSlug: "other-tenant", limit: 25, offset: 0, outcome: "denied", search: "integration" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.workspace.files.list({ organizationSlug: "other-tenant", limit: 25, offset: 0, category: "backup", search: "archive" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.workspace.network.listRouters({ organizationSlug: "other-tenant", limit: 25, offset: 0, status: "offline", search: "edge" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.workspace.billing.listPayments({ organizationSlug: "other-tenant", limit: 25, offset: 0, status: "refunded", search: "PAY-" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.workspace.billing.journalEntries({ organizationSlug: "other-tenant", limit: 25, offset: 0, search: "JRN-" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.workspace.network.listSites({ organizationSlug: "other-tenant", limit: 25, offset: 0, search: "site" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.workspace.network.listSpeedProfiles({ organizationSlug: "other-tenant", limit: 25, offset: 0, search: "tier" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.workspace.customers.updateStatus({ organizationSlug: "other-tenant", customerId: 1, status: "blocked" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.workspace.customers.assignServicePlan({ organizationSlug: "other-tenant", customerId: 1, servicePlanId: 2 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.workspace.alerts.saveRule({ organizationSlug: "other-tenant", key: "router_offline", severity: "critical", isEnabled: false })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.workspace.servicePlans.list({ organizationSlug: "other-tenant", limit: 25, offset: 0, status: "active", search: "pro" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
