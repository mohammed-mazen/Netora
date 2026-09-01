import { beforeAll, describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { createOrganizationForUser, createUserWithPassword } from "./db";
import { appRouter } from "./routers";

let testUser: Awaited<ReturnType<typeof createUserWithPassword>>;
let testOrganizationSlug = "";

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@netora-test.local`;
}

function uniqueSlug(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function authenticatedContext(): TrpcContext {
  return {
    user: testUser,
    req: { protocol: "https", headers: { "user-agent": "Vitest Agent" }, ip: "127.0.0.1" } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

beforeAll(async () => {
  testUser = await createUserWithPassword({
    email: uniqueEmail("support-device"),
    passwordHash: "$2a$12$examplehashexamplehashexamplehashexamplehash",
    name: "اختبار الدعم",
  });

  const organization = await createOrganizationForUser({
    userId: testUser.id,
    name: "مؤسسة الدعم",
    slug: uniqueSlug("support-device"),
    timezone: "Asia/Riyadh",
    currency: "SAR",
  });

  testOrganizationSlug = (organization as { organizationSlug?: string; slug?: string }).organizationSlug ?? (organization as { slug?: string }).slug ?? "";
});

describe("support tickets with device metadata", () => {
  it("creates a ticket and returns stored device metadata in the listing", async () => {
    const caller = appRouter.createCaller(authenticatedContext());

    await caller.workspace.support.create({
      organizationSlug: testOrganizationSlug,
      subject: "مشكلة مصادقة مع الراوتر",
      priority: "high",
      metadata: { userAgent: "Netora QA Browser", macAddress: "aa:bb:cc:dd:ee:ff" },
    });

    const rows = await caller.workspace.support.list({
      organizationSlug: testOrganizationSlug,
      limit: 10,
      offset: 0,
      search: undefined,
      status: undefined,
    });

    expect(rows[0]?.deviceMacAddress).toBe("AA:BB:CC:DD:EE:FF");
    expect(rows[0]?.deviceUserAgent).toContain("Netora QA Browser");
  });
});
