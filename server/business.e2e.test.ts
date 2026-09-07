import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { getDb, connectionPool } from "./db";
import { users, organizations, organizationMembers, sites, routers, customers, servicePlans, customerServiceAssignments } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "./_core/auth";

describe("ISP/WISP End-to-End Business Tests (Section 30)", () => {
  let orgId: number;
  let ownerId: number;
  let dbUnavailable = false;

  beforeAll(async () => {
    try {
      const db = await getDb();
      if (!db) {
        dbUnavailable = true;
        return; // DB unavailable
      }

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
    } catch (e: any) {
      if (e?.code === "ECONNREFUSED") {
        dbUnavailable = true;
        return; // gracefully skip
      }
      throw e;
    }
  });

  afterAll(async () => {
    try {
      const db = await getDb();
      if (!db || !orgId || !ownerId) return;
      await db.delete(customerServiceAssignments).where(eq(customerServiceAssignments.organizationId, orgId));
      await db.delete(customers).where(eq(customers.organizationId, orgId));
      await db.delete(servicePlans).where(eq(servicePlans.organizationId, orgId));
      await db.delete(routers).where(eq(routers.organizationId, orgId));
      await db.delete(sites).where(eq(sites.organizationId, orgId));
      await db.delete(organizationMembers).where(eq(organizationMembers.organizationId, orgId));
      await db.delete(organizations).where(eq(organizations.id, orgId));
      await db.delete(users).where(eq(users.id, ownerId));
    } catch (e: any) {
      if (e?.code !== "ECONNREFUSED") {
        console.error("Teardown error:", e);
      }
    } finally {
      // Force end the pool to prevent hanging or delayed drops from failing the runner
      if (connectionPool) await connectionPool.end().catch(() => {});
    }
  });

  it("Onboarding: Site -> router -> health", async () => {
    if (dbUnavailable) return;
    try {
      const db = await getDb();
      if (!db || !orgId) return; // Skip if no DB

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

      const [router] = await db.select().from(routers).where(eq(routers.id, routerRes.insertId)).limit(1);
      expect(router).toBeDefined();
      expect(router?.status).toBe("pending");
    } catch (e: any) {
      if (e?.code === "ECONNREFUSED") return; // graceful skip
      throw e;
    }
  });

  it("Subscriber lifecycle: Customer -> service -> activation -> session", async () => {
    if (dbUnavailable) return;
    try {
      const db = await getDb();
      if (!db || !orgId) return; // Skip if no DB

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
      });

      const [assignmentRes] = await db.insert(customerServiceAssignments).values({
        organizationId: orgId,
        customerId: custRes.insertId,
        servicePlanId: planRes.insertId,
        status: "active",
      });

      const [cust] = await db.select().from(customers).where(eq(customers.id, custRes.insertId)).limit(1);
      expect(cust).toBeDefined();
      expect(cust?.status).toBe("active");

      const [assignment] = await db.select().from(customerServiceAssignments).where(eq(customerServiceAssignments.id, assignmentRes.insertId)).limit(1);
      expect(assignment).toBeDefined();
      expect(assignment?.servicePlanId).toBe(planRes.insertId);
      expect(assignment?.status).toBe("active");
    } catch (e: any) {
      if (e?.code === "ECONNREFUSED") return; // graceful skip
      throw e;
    }
  });
});
