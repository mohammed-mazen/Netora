import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("platform router authorization", () => {
  it("rejects invalid plan-list pagination before querying", async () => {
    const ctx: TrpcContext = {
      user: { id: 56, name: "مدير اختبار", email: "admin-platform-validation@netora.local", passwordHash: "$2a$12$examplehashexamplehashexamplehashexamplehash", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.platform.subscriptionPlans.list({ limit: 101, offset: 0, search: "starter" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.platform.subscriptionPlans.list({ limit: 25, offset: -1, search: "starter" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("does not expose platform organizations to a non-admin user", async () => {
    const ctx: TrpcContext = {
      user: { id: 55, name: "مستخدم عادي", email: "regular-platform-test@netora.local", passwordHash: "$2a$12$examplehashexamplehashexamplehashexamplehash", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.platform.organizations({ limit: 25, offset: 0, search: "tenant" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.platform.subscriptionPlans.list({ limit: 25, offset: 0, search: "starter" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.platform.subscriptions({ limit: 25, offset: 0, search: "starter", status: "active" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.platform.supportTickets({ limit: 25, offset: 0, search: "tenant", status: "open" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
