import { beforeAll, describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { createOrganizationForUser, createUserWithPassword } from "./db";
import { appRouter } from "./routers";

let testUser: Awaited<ReturnType<typeof createUserWithPassword>>;
let organizationSlug = "";

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@netora-test.local`;
}

function uniqueSlug(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

beforeAll(async () => {
  testUser = await createUserWithPassword({
    email: uniqueEmail("feature-validation"),
    passwordHash: "$2a$12$examplehashexamplehashexamplehashexamplehash",
    name: "مستخدم تحقق",
  });

  const organization = await createOrganizationForUser({
    userId: testUser.id,
    name: "مؤسسة تحقق الميزات",
    slug: uniqueSlug("feature-validation"),
    timezone: "Asia/Riyadh",
    currency: "SAR",
  });

  organizationSlug = organization.organizationSlug;
});

function authenticatedContext(): TrpcContext {
  return {
    user: testUser,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("feature router validation", () => {
  it("rejects invalid API token payloads", async () => {
    const caller = appRouter.createCaller(authenticatedContext());
    await expect(caller.apiTokens.create({ organizationSlug, name: "x", abilities: [] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects malformed MAC security payloads", async () => {
    const caller = appRouter.createCaller(authenticatedContext());
    await expect(caller.macSecurity.rules.save({ organizationSlug, macAddress: "AA", listType: "whitelist" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects underspecified hotspot page payloads", async () => {
    const caller = appRouter.createCaller(authenticatedContext());
    await expect(caller.hotspotPages.save({ organizationSlug, name: "x" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects invalid advanced report builder pin payloads", async () => {
    const caller = appRouter.createCaller(authenticatedContext());
    await expect(caller.reportBuilder.access.savePin({ organizationSlug, pin: "123" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects oversized card import payloads", async () => {
    const caller = appRouter.createCaller(authenticatedContext());
    await expect(caller.cards.imports.create({ organizationSlug, source: "csv", content: "a".repeat(1_000_001) })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects invalid backup scheduling retention", async () => {
    const caller = appRouter.createCaller(authenticatedContext());
    await expect(caller.backup.schedule.save({ organizationSlug, frequency: "daily", retentionDays: 0, isEnabled: true })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects invalid SMS template payloads", async () => {
    const caller = appRouter.createCaller(authenticatedContext());
    await expect(caller.sms.templates.save({ organizationSlug, key: "x", name: "x", namespace: "direct", body: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects empty dynamic settings batches", async () => {
    const caller = appRouter.createCaller(authenticatedContext());
    await expect(caller.dynamicSettings.save({ organizationSlug, module: "hotspot", items: [] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
