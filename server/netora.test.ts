import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function authenticatedContext(): TrpcContext {
  return {
    user: {
      id: 44,
      name: "مستخدم اختبار",
      email: "test@netora.local",
      passwordHash: "$2a$12$examplehashexamplehashexamplehashexamplehash",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("netora router", () => {
  it("returns a non-operational workspace state without integration credentials", async () => {
    const caller = appRouter.createCaller(authenticatedContext());
    const data = await caller.netora.overview();

    expect(data.mode).toBe("preview");
    expect(data.network.activeSessions).toBe(0);
    expect(data.dataFreshness).toContain("قبل ربط");
  });

  it("accepts only known module identifiers", async () => {
    const caller = appRouter.createCaller(authenticatedContext());
    const data = await caller.netora.workspace({ module: "network" });

    expect(data.status).toBe("ready_for_configuration");
  });
});

