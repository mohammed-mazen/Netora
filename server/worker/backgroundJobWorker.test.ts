import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { backgroundJobs, smsMessages, monitorSettings, monitorSamples, users, organizations } from "../../drizzle/schema";
import {
  createOrganizationForUser,
  createTenantCustomer,
  createTenantRouter,
  createUserWithPassword,
  getDb,
  queueTenantSmsMessage,
  saveTenantSmsSettings,
  updateTenantRouterCredential,
} from "../db";
import { setRouterCredential } from "../secrets";
import { applyRadiusAccountingEvent } from "../db";
import { claimNextJob, executeJob } from "./backgroundJobWorker";

// This suite runs against the REAL shared dev DB (no mocking), and
// claimNextJob() is a genuine FIFO queue: it always returns the
// oldest eligible (queued, or due-retrying) row across ALL organizations —
// not just the one this test just inserted. When the full `vitest run`
// suite executes every file, other test files (e.g. tenant.router.test.ts's
// queueDisconnect/queueHealthCheck-adjacent paths) or earlier `it()` blocks
// in *this* file can leave rows behind that are still "queued" or whose
// retry backoff has since elapsed ("retrying" + due nextRetryAt). If any
// such row is older than the row this test is about to insert, claimNextJob
// would correctly (by FIFO contract) hand back that older foreign row
// instead of this test's own job — breaking `expect(claimed?.id).toBe(jobId)`
// non-deterministically depending on suite timing, not on any bug in the
// worker itself.
//
// We reset the table directly (DELETE, not executeJob) rather than
// draining via the real claim/execute loop: several leftover rows target
// unreachable test IPs and each real executeJob() call against them blocks
// for the full ~8s MikroTik REQUEST_TIMEOUT_MS, which — multiplied across
// several stale rows — can blow past vitest's hook timeout. A direct
// DELETE is a test-fixture reset, not a change to worker behavior; it just
// guarantees this test's own freshly-inserted job is the only — and
// therefore next — eligible row for claimNextJob(), without masking any
// real regression in the worker's claim/execute logic itself.
async function resetJobQueue() {
  const db = await getDb();
  if (!db) throw new Error("db unavailable in test");
  await db.delete(backgroundJobs);
}

beforeEach(async () => {
  await resetJobQueue();
});

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@netora-test.local`;
}

function uniqueSlug(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

async function createTestOrgAndRouter(prefix: string, overrides: { managementAddress?: string; connectionMode?: "api_ssl" | "rest_https" | "agent" } = {}) {
  const user = await createUserWithPassword({ email: uniqueEmail(prefix), passwordHash: "$2a$12$examplehashexamplehashexamplehashexamplehash" });
  const org = await createOrganizationForUser({ userId: user.id, name: `Test Org ${prefix}`, slug: uniqueSlug(prefix), timezone: "Asia/Riyadh", currency: "SAR" });
  const router = await createTenantRouter({
    organizationId: org.organizationId,
    name: `Router ${prefix}`,
    managementAddress: overrides.managementAddress ?? "10.255.255.3",
    connectionMode: overrides.connectionMode ?? "rest_https",
  });
  return { organizationId: org.organizationId, routerId: router.id };
}

async function insertJob(input: { organizationId: number; routerId: number | null; type: string; payload?: Record<string, unknown> }) {
  const db = await getDb();
  if (!db) throw new Error("db unavailable in test");
  const idempotencyKey = `test:${input.type}:${input.organizationId}:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const result = await db.insert(backgroundJobs).values({
    organizationId: input.organizationId,
    routerId: input.routerId,
    type: input.type,
    idempotencyKey,
    status: "queued",
    payload: input.payload ? JSON.stringify(input.payload) : null,
  });
  return Number(result[0]?.insertId);
}

async function fetchJob(jobId: number) {
  const db = await getDb();
  if (!db) throw new Error("db unavailable in test");
  const rows = await db.select().from(backgroundJobs).where(eq(backgroundJobs.id, jobId)).limit(1);
  return rows[0] ?? null;
}

describe("background job worker (real DB, no poll-interval wait — calls claimNextJob/executeJob directly)", () => {
  it("claims a queued job, marks it running+attempts incremented, then succeeds a router_health_check against a router with no credentials", async () => {
    const { organizationId, routerId } = await createTestOrgAndRouter("healthnocred");
    const jobId = await insertJob({ organizationId, routerId, type: "router_health_check" });

    const claimed = await claimNextJob();
    expect(claimed).not.toBeNull();
    expect(claimed?.id).toBe(jobId);
    expect(claimed?.attempts).toBe(1);

    // A router_health_check against a credential-less router fails gracefully
    // (checkRouterHealth returns ok:false), so the job should end up retrying,
    // not throw and not crash the worker loop.
    await executeJob(claimed!);

    const after = await fetchJob(jobId);
    expect(after?.status).toBe("retrying");
    expect(after?.lastError).toContain("بيانات اعتماد");
  });

  it("marks a job failed permanently once attempts reach the max retry count", async () => {
    const { organizationId, routerId } = await createTestOrgAndRouter("maxattempts");
    const jobId = await insertJob({ organizationId, routerId, type: "router_health_check" });

    const db = await getDb();
    if (!db) throw new Error("db unavailable in test");
    // Simulate a job that has already exhausted its retries.
    await db.update(backgroundJobs).set({ attempts: 5 }).where(eq(backgroundJobs.id, jobId));

    const claimed = await claimNextJob();
    expect(claimed?.id).toBe(jobId);
    expect(claimed?.attempts).toBe(6);

    await executeJob(claimed!);

    const after = await fetchJob(jobId);
    expect(after?.status).toBe("failed");
  });

  it("succeeds a router_health_check and updates router status when the router is reachable-with-credentials but times out gracefully (still marked offline, not thrown)", async () => {
    const { organizationId, routerId } = await createTestOrgAndRouter("healthcred", { managementAddress: "10.255.255.4" });
    const credentialRef = await setRouterCredential(routerId, { username: "admin", password: "test-pass" });
    await updateTenantRouterCredential({ organizationId, routerId, credentialRef });
    const jobId = await insertJob({ organizationId, routerId, type: "router_health_check" });

    const claimed = await claimNextJob();
    expect(claimed?.id).toBe(jobId);

    await executeJob(claimed!);

    const after = await fetchJob(jobId);
    // Unreachable IP -> checkRouterHealth resolves ok:false (timeout/connection
    // error) rather than throwing, so the job is retried, never left "running".
    expect(after?.status).toBe("retrying");
    expect(after?.lastError).toBeTruthy();
  }, 15000);

  it("rejects connectionMode=agent without crashing the worker (no local agent protocol implemented)", async () => {
    const { organizationId, routerId } = await createTestOrgAndRouter("agentmode", { connectionMode: "agent" });
    const jobId = await insertJob({ organizationId, routerId, type: "router_identity_read" });

    const claimed = await claimNextJob();
    await executeJob(claimed!);

    const after = await fetchJob(jobId);
    expect(after?.status).toBe("retrying");
    expect(after?.lastError).toContain("وكيلًا محليًا");
  });

  it("treats radius_policy_projection as a no-op success (documented MVP scope decision)", async () => {
    const { organizationId, routerId } = await createTestOrgAndRouter("policyproj");
    const jobId = await insertJob({ organizationId, routerId, type: "radius_policy_projection" });

    const claimed = await claimNextJob();
    await executeJob(claimed!);

    const after = await fetchJob(jobId);
    expect(after?.status).toBe("succeeded");
  });

  it("fails gracefully with a clear error for an unsupported job type", async () => {
    const { organizationId, routerId } = await createTestOrgAndRouter("unsupported");
    const jobId = await insertJob({ organizationId, routerId, type: "totally_unknown_job_type" });

    const claimed = await claimNextJob();
    await executeJob(claimed!);

    const after = await fetchJob(jobId);
    expect(after?.status).toBe("retrying");
    expect(after?.lastError).toContain("نوع مهمة غير مدعوم");
  });

  it("radius_disconnect_session: no-ops successfully when the session is already closed", async () => {
    const { organizationId, routerId } = await createTestOrgAndRouter("disconnectclosed");
    const customer = await createTenantCustomer({ organizationId, fullName: "Closed Session Customer", username: `cust-${Date.now()}` });
    const sessionResult = await applyRadiusAccountingEvent({
      organizationId, routerId, customerId: customer.id,
      acctUniqueId: `sess-${Date.now()}-closed`, protocol: "hotspot", statusType: "stop",
      inputOctets: "10", outputOctets: "20", eventTime: new Date(),
    });

    const jobId = await insertJob({ organizationId, routerId, type: "radius_disconnect_session", payload: { sessionId: sessionResult.id } });
    const claimed = await claimNextJob();
    await executeJob(claimed!);

    const after = await fetchJob(jobId);
    expect(after?.status).toBe("succeeded");
  });

  it("radius_disconnect_session: fails gracefully (retrying) when the session's router is unreachable", async () => {
    const { organizationId, routerId } = await createTestOrgAndRouter("disconnectactive", { managementAddress: "10.255.255.5" });
    const credentialRef = await setRouterCredential(routerId, { username: "admin", password: "test-pass" });
    await updateTenantRouterCredential({ organizationId, routerId, credentialRef });
    const customer = await createTenantCustomer({ organizationId, fullName: "Active Session Customer", username: `cust-${Date.now()}` });
    const sessionResult = await applyRadiusAccountingEvent({
      organizationId, routerId, customerId: customer.id,
      acctUniqueId: `sess-${Date.now()}-active`, protocol: "pppoe", statusType: "start",
      inputOctets: "0", outputOctets: "0", eventTime: new Date(),
    });

    const jobId = await insertJob({ organizationId, routerId, type: "radius_disconnect_session", payload: { sessionId: sessionResult.id } });
    const claimed = await claimNextJob();
    await executeJob(claimed!);

    const after = await fetchJob(jobId);
    expect(after?.status).toBe("retrying");
    expect(after?.lastError).toBeTruthy();
  }, 15000);

  it("sms_send: dispatches via the configured cloud gateway and marks the message sent", async () => {
    const received: string[] = [];
    const server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", chunk => chunks.push(chunk as Buffer));
      req.on("end", () => {
        received.push(Buffer.concat(chunks).toString("utf8"));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ id: "ok" }));
      });
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;

    try {
      const user = await createUserWithPassword({ email: uniqueEmail("smssend"), passwordHash: "$2a$12$examplehashexamplehashexamplehashexamplehash" });
      const org = await createOrganizationForUser({ userId: user.id, name: `Test Org smssend`, slug: uniqueSlug("smssend"), timezone: "Asia/Riyadh", currency: "SAR" });
      await saveTenantSmsSettings({
        organizationId: org.organizationId,
        serverType: "cloud",
        simCardsCount: "one",
        defaultSimCard: 1,
        sendingType: "auto",
        secretValue: JSON.stringify({ url: `http://127.0.0.1:${port}/send`, apiKey: "worker-key", from: "Netora" }),
      });
      const queued = await queueTenantSmsMessage({ organizationId: org.organizationId, userId: user.id, toNumber: "966511111111", body: "رسالة العامل" });

      const claimed = await claimNextJob();
      expect(claimed?.type).toBe("sms_send");
      await executeJob(claimed!);

      const after = await fetchJob(claimed!.id);
      expect(after?.status).toBe("succeeded");
      const db = await getDb();
      if (!db) throw new Error("db unavailable in test");
      const rows = await db.select({ id: smsMessages.id, status: smsMessages.status }).from(smsMessages).where(eq(smsMessages.id, queued.id)).limit(1);
      expect(rows[0]?.status).toBe("sent");
      expect(JSON.parse(received[0] ?? "{}")).toMatchObject({ to: "966511111111", text: "رسالة العامل" });
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  it("sms_send: marks the message failed permanently when the gateway rejects the request", async () => {
    const server = createServer((_req, res) => {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("invalid number");
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;

    try {
      const user = await createUserWithPassword({ email: uniqueEmail("smsfail"), passwordHash: "$2a$12$examplehashexamplehashexamplehashexamplehash" });
      const org = await createOrganizationForUser({ userId: user.id, name: `Test Org smsfail`, slug: uniqueSlug("smsfail"), timezone: "Asia/Riyadh", currency: "SAR" });
      await saveTenantSmsSettings({
        organizationId: org.organizationId,
        serverType: "cloud",
        simCardsCount: "one",
        defaultSimCard: 1,
        sendingType: "auto",
        secretValue: JSON.stringify({ url: `http://127.0.0.1:${port}/send`, apiKey: "worker-key" }),
      });
      const queued = await queueTenantSmsMessage({ organizationId: org.organizationId, userId: user.id, toNumber: "000", body: "fail" });
      const claimed = await claimNextJob();
      await executeJob(claimed!);

      const after = await fetchJob(claimed!.id);
      expect(after?.status).toBe("failed");
      const db = await getDb();
      if (!db) throw new Error("db unavailable in test");
      const rows = await db.select({ status: smsMessages.status }).from(smsMessages).where(eq(smsMessages.id, queued.id)).limit(1);
      expect(rows[0]?.status).toBe("failed");
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  it("monitor_alert_dispatch: dispatches telegram alert when threshold is crossed and marks success", async () => {
    const db = await getDb();
    if (!db) throw new Error("db unavailable");

    const userResult = await db.insert(users).values({ openId: `id_${Date.now()}`, email: `test-monitor-${Date.now()}@example.com`, passwordHash: "dummy" });
    const orgResult = await db.insert(organizations).values({ name: "monitor org test", slug: `test_slug_${Date.now()}`, status: "trial", ownerUserId: Number(userResult[0].insertId) });
    const realOrgId = Number(orgResult[0].insertId);
    await db.insert(monitorSettings).values({ organizationId: realOrgId, batteryNotification: 1, batteryCriticalPercentage: 20, telegramChatId: "chat123" }).onDuplicateKeyUpdate({ set: { batteryNotification: 1, batteryCriticalPercentage: 20, telegramChatId: "chat123" }});
    const sample = await db.insert(monitorSamples).values({ organizationId: realOrgId, batteryPercent: 10, serviceStatus: "healthy" });
    const sampleId = Number(sample[0].insertId);

    const jobInsert = await db.insert(backgroundJobs).values({ organizationId: realOrgId, routerId: null, type: "monitor_alert_dispatch", idempotencyKey: `sample_${sampleId}`, status: "queued", payload: JSON.stringify({ operation: "monitor_alert_dispatch", sampleId }) });
    const jobId = Number(jobInsert[0].insertId);

    const job = await claimNextJob();
    expect(job?.id).toBe(jobId);
    await executeJob(job!);

    const after = await fetchJob(jobId);
    expect(after?.status).toBe("succeeded");
  });
});
