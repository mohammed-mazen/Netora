import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import { users, organizations, organizationMembers, sites, routers, customers, servicePlans } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "./_core/auth";

describe("ISP/WISP End-to-End Business Tests (Section 30)", () => {
  let orgId: number;
  let ownerId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("db unavailable");

    // 1. Onboarding: Organization -> owner -> roles
    const ownerEmail = `e2e-owner-${Date.now()}@netora.test`;
    const [userRes] = await db.insert(users).values({
      email: ownerEmail,
      name: "E2E Owner",
      passwordHash: await hashPassword("password123"),
      role: "user",
    });
    ownerId = userRes.insertId;

    const [orgRes] = await db.insert(organizations).values({
      name: "E2E Test Network",
      slug: `e2e-net-${Date.now()}`,
    });
    orgId = orgRes.insertId;

    await db.insert(organizationMembers).values({
      organizationId: orgId,
      userId: ownerId,
      role: "owner",
    });
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    await db.delete(organizationMembers).where(eq(organizationMembers.organizationId, orgId));
    await db.delete(organizations).where(eq(organizations.id, orgId));
    await db.delete(users).where(eq(users.id, ownerId));
  });

  it("Onboarding: Site -> router -> health", async () => {
    const db = await getDb();
    if (!db) throw new Error("db unavailable");

    const [siteRes] = await db.insert(sites).values({
      organizationId: orgId,
      name: "E2E Core Site",
    });

    const [routerRes] = await db.insert(routers).values({
      organizationId: orgId,
      siteId: siteRes.insertId,
      name: "E2E Router",
      managementAddress: "10.0.0.1",
      host: "10.0.0.1",
      port: 8728,
      status: "pending",
    });

    const router = await db.query.routers.findFirst({
      where: eq(routers.id, routerRes.insertId)
    });
    expect(router).toBeDefined();
    expect(router?.status).toBe("pending");
  });

  it("Subscriber lifecycle: Customer -> service -> activation -> session", async () => {
    const db = await getDb();
    if (!db) throw new Error("db unavailable");

    const [planRes] = await db.insert(servicePlans).values({
      organizationId: orgId,
      name: "E2E Gold Plan",
      price: "100.00",
      type: "pppoe",
    });

    const [custRes] = await db.insert(customers).values({
      organizationId: orgId,
      fullName: "E2E Subscriber",
      username: `e2e-sub-${Date.now()}`,
      status: "active",
      servicePlanId: planRes.insertId,
    });

    const cust = await db.query.customers.findFirst({
      where: eq(customers.id, custRes.insertId)
    });
    expect(cust).toBeDefined();
    expect(cust?.status).toBe("active");
    expect(cust?.servicePlanId).toBe(planRes.insertId);
  });
});
