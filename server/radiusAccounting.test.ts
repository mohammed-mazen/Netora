import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import type { Server } from "http";
import { registerRadiusAccountingRoute } from "./radiusAccounting";
import {
  createOrganizationForUser,
  createTenantCustomer,
  createTenantRouter,
  createUserWithPassword,
  getDb,
} from "./db";
import { setIntegrationSecret } from "./secrets";
import { networkSessions } from "../drizzle/schema";
import { and, eq } from "drizzle-orm";

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@netora-test.local`;
}

function uniqueSlug(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function uniqueNas(prefix: string) {
  return `nas-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

async function createTestOrgWithRouter(prefix: string, nasIdentifier: string) {
  const user = await createUserWithPassword({ email: uniqueEmail(prefix), passwordHash: "$2a$12$examplehashexamplehashexamplehashexamplehash" });
  const org = await createOrganizationForUser({ userId: user.id, name: `Test Org ${prefix}`, slug: uniqueSlug(prefix), timezone: "Asia/Riyadh", currency: "SAR" });
  const router = await createTenantRouter({
    organizationId: org.organizationId,
    name: `Router ${prefix}`,
    managementAddress: "10.255.255.2",
    connectionMode: "rest_https",
    nasIdentifier,
  });
  return { organizationId: org.organizationId, routerId: router.id };
}

async function fetchSessionRow(organizationId: number, acctUniqueId: string) {
  const db = await getDb();
  if (!db) throw new Error("db unavailable in test");
  const rows = await db
    .select()
    .from(networkSessions)
    .where(and(eq(networkSessions.organizationId, organizationId), eq(networkSessions.acctUniqueId, acctUniqueId)))
    .limit(1);
  return rows[0] ?? null;
}

// A real Express server on an ephemeral port — this project has no
// supertest-style dependency, so we exercise the endpoint over real HTTP,
// consistent with the rest of the test suite's "hit the real thing" style.
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  registerRadiusAccountingRoute(app);
  await new Promise<void>(resolve => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
});

describe("POST /api/radius/accounting (real HTTP + real DB)", () => {
  it("rejects a request missing required fields with 400", async () => {
    const res = await fetch(`${baseUrl}/api/radius/accounting`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nasIdentifier: "", acctStatusType: "Start" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.accepted).toBe(false);
  });

  it("returns 404 when the NAS-Identifier does not match any registered router", async () => {
    const res = await fetch(`${baseUrl}/api/radius/accounting`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nasIdentifier: uniqueNas("unknown"),
        acctStatusType: "Start",
        acctUniqueId: "sess-unknown-1",
      }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.accepted).toBe(false);
  });

  it("accepts an unauthenticated event (with a warning) when no RADIUS shared secret is configured yet", async () => {
    const nasIdentifier = uniqueNas("nosecret");
    const { organizationId } = await createTestOrgWithRouter("nosecret", nasIdentifier);
    const acctUniqueId = `sess-${Date.now()}-nosecret`;

    const res = await fetch(`${baseUrl}/api/radius/accounting`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nasIdentifier,
        acctStatusType: "Start",
        acctUniqueId,
        protocol: "hotspot",
        acctInputOctets: "0",
        acctOutputOctets: "0",
      }),
    });
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.accepted).toBe(true);
    expect(body.action).toBe("created");

    const row = await fetchSessionRow(organizationId, acctUniqueId);
    expect(row).not.toBeNull();
    expect(row?.state).toBe("active");
  });

  it("rejects an event with a missing/incorrect shared secret once one is configured for the organization", async () => {
    const nasIdentifier = uniqueNas("secured");
    const { organizationId } = await createTestOrgWithRouter("secured", nasIdentifier);
    await setIntegrationSecret({ organizationId, kind: "radius", value: "correct-shared-secret" });

    const noHeaderRes = await fetch(`${baseUrl}/api/radius/accounting`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nasIdentifier, acctStatusType: "Start", acctUniqueId: "sess-secured-1" }),
    });
    expect(noHeaderRes.status).toBe(401);

    const wrongHeaderRes = await fetch(`${baseUrl}/api/radius/accounting`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Radius-Shared-Secret": "wrong-secret" },
      body: JSON.stringify({ nasIdentifier, acctStatusType: "Start", acctUniqueId: "sess-secured-2" }),
    });
    expect(wrongHeaderRes.status).toBe(401);
  });

  it("accepts a correctly authenticated event and processes the full Start -> Interim-Update -> Stop lifecycle", async () => {
    const nasIdentifier = uniqueNas("lifecycle");
    const { organizationId } = await createTestOrgWithRouter("lifecycle", nasIdentifier);
    await setIntegrationSecret({ organizationId, kind: "radius", value: "lifecycle-secret" });
    const customer = await createTenantCustomer({ organizationId, fullName: "Test Customer", username: `cust-${Date.now()}` });
    const acctUniqueId = `sess-${Date.now()}-lifecycle`;
    const headers = { "Content-Type": "application/json", "X-Radius-Shared-Secret": "lifecycle-secret" };

    const startRes = await fetch(`${baseUrl}/api/radius/accounting`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        nasIdentifier, acctStatusType: "Start", acctUniqueId, username: customer.username,
        protocol: "pppoe", acctInputOctets: "100", acctOutputOctets: "200",
      }),
    });
    expect(startRes.status).toBe(202);
    const startBody = await startRes.json();
    expect(startBody.action).toBe("created");

    let row = await fetchSessionRow(organizationId, acctUniqueId);
    expect(row?.state).toBe("active");
    expect(row?.customerId).toBe(customer.id);
    expect(row?.inputOctets).toBe("100");

    const interimRes = await fetch(`${baseUrl}/api/radius/accounting`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        nasIdentifier, acctStatusType: "Interim-Update", acctUniqueId, username: customer.username,
        protocol: "pppoe", acctInputOctets: "5000", acctOutputOctets: "9000",
      }),
    });
    expect(interimRes.status).toBe(202);
    const interimBody = await interimRes.json();
    expect(interimBody.action).toBe("updated");

    row = await fetchSessionRow(organizationId, acctUniqueId);
    expect(row?.state).toBe("active");
    expect(row?.inputOctets).toBe("5000");
    expect(row?.stoppedAt).toBeNull();

    const stopRes = await fetch(`${baseUrl}/api/radius/accounting`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        nasIdentifier, acctStatusType: "Stop", acctUniqueId, username: customer.username,
        protocol: "pppoe", acctInputOctets: "12345", acctOutputOctets: "67890",
      }),
    });
    expect(stopRes.status).toBe(202);
    const stopBody = await stopRes.json();
    expect(stopBody.action).toBe("updated");

    row = await fetchSessionRow(organizationId, acctUniqueId);
    expect(row?.state).toBe("closed");
    expect(row?.inputOctets).toBe("12345");
    expect(row?.outputOctets).toBe("67890");
    expect(row?.stoppedAt).not.toBeNull();
  });

  it("defensively creates a closed session if a Stop event arrives without a prior Start (e.g. worker restart mid-session)", async () => {
    const nasIdentifier = uniqueNas("orphanstop");
    const { organizationId } = await createTestOrgWithRouter("orphanstop", nasIdentifier);
    const acctUniqueId = `sess-${Date.now()}-orphanstop`;

    const res = await fetch(`${baseUrl}/api/radius/accounting`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nasIdentifier, acctStatusType: "Stop", acctUniqueId,
        protocol: "hotspot", acctInputOctets: "999", acctOutputOctets: "888",
      }),
    });
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.action).toBe("created");

    const row = await fetchSessionRow(organizationId, acctUniqueId);
    expect(row?.state).toBe("closed");
    expect(row?.stoppedAt).not.toBeNull();
  });
});
