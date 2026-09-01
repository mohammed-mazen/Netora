// In-process background worker for the `background_jobs` queue table.
// Polls for queued/retrying jobs and dispatches them to the real MikroTik
// RouterOS client (server/mikrotik.ts) or RADIUS session-disconnect logic,
// then persists success/failure back onto the job row (and, for router
// health checks, onto the router's own status/lastSeenAt/routerOsVersion).
//
// This is a simple polling worker (not a distributed queue) — it is designed
// to run as a single instance alongside the API process on one VPS (see
// ecosystem.config.cjs). If you outgrow a single VPS, swap this file's
// `claimNextJob`/`tick` loop for a real queue (e.g. BullMQ + Redis) without
// touching the per-job-type handlers below.
import { and, asc, eq, lt, lte, or } from "drizzle-orm";
import { backgroundJobs } from "../../drizzle/schema";
import { getDb, getRouterById, getSessionForDisconnect, getTenantSmsMessageForDispatch, markSessionClosed, markTenantSmsMessageStatus, updateRouterHealthResult, updateTenantMonitorActionStatus, createTenantBackupJob } from "../db";
import { checkRouterHealth, disconnectRouterSession, runRouterSystemCommand } from "../mikrotik";
import { summarizeMonitorActionResult, type MonitorAction } from "../monitorActions";
import { dispatchTenantSms } from "../smsDispatch";

const POLL_INTERVAL_MS = 5000;
const MAX_ATTEMPTS = 5;
const RETRY_BACKOFF_MS = 30_000;

// Retention window for terminal jobs (succeeded/failed) — README "الخطوات
// التالية الموصى بها" #9 flagged that background_jobs grows unbounded with
// no cleanup. Terminal rows older than this are deleted opportunistically
// from the poll loop (see maybeCleanupOldJobs below) rather than via a
// separate cron process, keeping the single-VPS/no-scheduler operating
// model described in architecture.md. This only ever deletes rows already
// in a terminal state (succeeded/failed) — queued/running/retrying jobs are
// never touched regardless of age.
const JOB_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
// Only run the cleanup sweep once per this many ticks (not every 5s poll)
// since it is a bulk DELETE, not a per-job operation.
const CLEANUP_EVERY_N_TICKS = 720; // ~1 hour at the 5s poll interval

let timer: NodeJS.Timeout | null = null;
let ticksSinceCleanup = 0;

/** Exported for direct testing. Deletes terminal (succeeded/failed) jobs older than JOB_RETENTION_MS. */
export async function cleanupOldJobs(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const cutoff = new Date(Date.now() - JOB_RETENTION_MS);
  const result = await db.delete(backgroundJobs).where(
    and(
      or(eq(backgroundJobs.status, "succeeded"), eq(backgroundJobs.status, "failed")),
      lt(backgroundJobs.updatedAt, cutoff),
    ),
  );
  return Number((result[0] as { affectedRows?: number } | undefined)?.affectedRows ?? 0);
}

export type Job = typeof backgroundJobs.$inferSelect;

/** Exported for direct testing (server/worker/backgroundJobWorker.test.ts) without waiting on the poll interval. */
export async function claimNextJob(): Promise<Job | null> {
  const db = await getDb();
  if (!db) return null;

  // Deterministic FIFO ordering (oldest-created first) — without this, MySQL
  // gives no guaranteed row order for an unordered SELECT, so under load
  // (many due jobs from different tenants/tests) claimNextJob could pick an
  // arbitrary eligible row instead of the actual longest-waiting one, which
  // both starves old jobs and made test assertions non-deterministic when
  // the shared dev DB had other due rows left over from earlier tests.
  const candidates = await db
    .select()
    .from(backgroundJobs)
    .where(
      or(
        eq(backgroundJobs.status, "queued"),
        and(eq(backgroundJobs.status, "retrying"), lte(backgroundJobs.nextRetryAt, new Date())),
      ),
    )
    .orderBy(asc(backgroundJobs.createdAt), asc(backgroundJobs.id))
    .limit(1);

  const job = candidates[0];
  if (!job) return null;

  const nextAttempts = job.attempts + 1;
  await db.update(backgroundJobs).set({ status: "running", attempts: nextAttempts }).where(eq(backgroundJobs.id, job.id));
  // Return the post-update snapshot (not the pre-update row) so callers
  // (executeJob's retry/max-attempts logic) see the correct attempts count.
  return { ...job, status: "running", attempts: nextAttempts };
}

async function markSucceeded(jobId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(backgroundJobs).set({ status: "succeeded", lastError: null }).where(eq(backgroundJobs.id, jobId));
}

async function markFailedOrRetrying(job: Job, error: string) {
  const db = await getDb();
  if (!db) return;
  if (job.attempts >= MAX_ATTEMPTS) {
    await db.update(backgroundJobs).set({ status: "failed", lastError: error }).where(eq(backgroundJobs.id, job.id));
    return;
  }
  await db.update(backgroundJobs).set({
    status: "retrying",
    lastError: error,
    nextRetryAt: new Date(Date.now() + RETRY_BACKOFF_MS * job.attempts),
  }).where(eq(backgroundJobs.id, job.id));
}

async function handleRouterHealthCheck(job: Job): Promise<{ ok: boolean; error?: string }> {
  if (!job.routerId) return { ok: false, error: "المهمة لا تحمل معرّف راوتر" };
  const router = await getRouterById(job.routerId);
  if (!router) return { ok: false, error: "الراوتر المرتبط بالمهمة غير موجود" };

  const result = await checkRouterHealth(router);
  await updateRouterHealthResult({
    routerId: router.id,
    status: result.ok ? "healthy" : "offline",
    routerOsVersion: result.routerOsVersion ?? null,
  });
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

async function handleRouterIdentityRead(job: Job): Promise<{ ok: boolean; error?: string }> {
  // Identity read shares the same REST call as the health check (RouterOS
  // REST has no separate lightweight identity-only endpoint worth a second
  // round trip policy-wise); the identity value itself isn't persisted
  // anywhere yet (routers.name is user-supplied), so this operation is
  // currently a connectivity+read verification alias of the health check.
  return handleRouterHealthCheck(job);
}

async function handleRadiusDisconnect(job: Job): Promise<{ ok: boolean; error?: string }> {
  if (!job.routerId) return { ok: false, error: "المهمة لا تحمل معرّف راوتر" };
  let payload: { sessionId?: number } = {};
  try {
    payload = job.payload ? JSON.parse(job.payload) : {};
  } catch {
    return { ok: false, error: "حمولة المهمة غير صالحة" };
  }
  if (!payload.sessionId) return { ok: false, error: "المهمة لا تحمل معرّف جلسة" };

  const [router, session] = await Promise.all([getRouterById(job.routerId), getSessionForDisconnect(payload.sessionId)]);
  if (!router) return { ok: false, error: "الراوتر المرتبط بالمهمة غير موجود" };
  if (!session) return { ok: false, error: "الجلسة المرتبطة بالمهمة غير موجودة" };
  if (session.state !== "active") return { ok: true }; // already closed, nothing to do

  const identifier = session.customerUsername;
  if (!identifier) return { ok: false, error: "تعذر تحديد معرّف الجلسة على الراوتر (لا يوجد اسم مستخدم عميل)" };

  const result = await disconnectRouterSession(router, { sessionIdentifier: identifier, protocol: session.protocol });
  if (result.ok) await markSessionClosed(session.id);
  return result;
}

async function handleRadiusPolicyProjection(_job: Job): Promise<{ ok: boolean; error?: string }> {
  // Full RADIUS policy projection (pushing per-plan bandwidth/quota
  // attributes into a radcheck/radreply-style store for FreeRADIUS to read)
  // is out of MVP scope — the current architecture relies on FreeRADIUS's
  // own SQL module reading directly from `service_plans`/`speed_profiles` at
  // authorization time rather than a separate projected cache table. This
  // operation is accepted (so queued jobs don't pile up as permanently
  // failed) but is a no-op until a projection strategy is decided.
  return { ok: true };
}

async function handleSmsSend(job: Job): Promise<{ ok: boolean; error?: string }> {
  let payload: { messageId?: number } = {};
  try {
    payload = job.payload ? JSON.parse(job.payload) : {};
  } catch {
    return { ok: false, error: "حمولة المهمة غير صالحة" };
  }
  if (!payload.messageId) return { ok: false, error: "المهمة لا تحمل معرّف رسالة" };

  const message = await getTenantSmsMessageForDispatch(payload.messageId);
  if (!message) return { ok: false, error: "الرسالة المرتبطة بالمهمة غير موجودة" };
  if (job.organizationId && message.organizationId !== job.organizationId) {
    return { ok: false, error: "الرسالة لا تتبع لمؤسسة المهمة" };
  }
  if (message.status === "sent") return { ok: true };

  const result = await dispatchTenantSms({
    toNumber: message.toNumber,
    body: message.body,
    serverType: message.serverType,
    secretRef: message.secretRef,
  });
  if (result.ok) {
    await markTenantSmsMessageStatus({ messageId: message.id, organizationId: message.organizationId, status: "sent" });
    return { ok: true };
  }
  if (!result.retryable) {
    await markTenantSmsMessageStatus({ messageId: message.id, organizationId: message.organizationId, status: "failed" });
    job.attempts = MAX_ATTEMPTS;
  }
  return { ok: false, error: result.error ?? "فشل إرسال الرسالة" };
}

/** Exported for direct testing — runs one job's handler + success/failure persistence without the poll loop. */
export async function executeJob(job: Job) {
  let outcome: { ok: boolean; error?: string };
  try {
    switch (job.type) {
      case "router_health_check":
        outcome = await handleRouterHealthCheck(job);
        break;
      case "router_identity_read":
        outcome = await handleRouterIdentityRead(job);
        break;
      case "radius_disconnect_session":
        outcome = await handleRadiusDisconnect(job);
        break;
      case "radius_policy_projection":
        outcome = await handleRadiusPolicyProjection(job);
        break;
      case "sms_send":
        outcome = await handleSmsSend(job);
        break;
      case "monitor_action":
        outcome = await handleMonitorAction(job);
        break;
      case "backup_run":
        outcome = await handleBackupRun(job);
        break;
      default:
        outcome = { ok: false, error: `نوع مهمة غير مدعوم: ${job.type}` };
    }
  } catch (error) {
    outcome = { ok: false, error: error instanceof Error ? error.message : "خطأ غير متوقع أثناء تنفيذ المهمة" };
  }

  if (outcome.ok) {
    await markSucceeded(job.id);
  } else {
    console.warn(`[Worker] job ${job.id} (${job.type}) failed: ${outcome.error}`);
    await markFailedOrRetrying(job, outcome.error ?? "فشل غير معروف");
  }
}

async function handleMonitorAction(job: Job): Promise<{ ok: boolean; error?: string }> {
  let payload: { logId?: number; routerId?: number; action?: string } = {};
  try {
    payload = job.payload ? JSON.parse(job.payload) : {};
  } catch {
    return { ok: false, error: "حمولة المهمة غير صالحة" };
  }
  if (!payload.logId || !payload.routerId || !payload.action) {
    return { ok: false, error: "المهمة لا تحمل معرّف سجل أو راوتر أو إجراء" };
  }
  if (payload.action !== "reboot" && payload.action !== "shutdown") {
    return { ok: false, error: `إجراء مراقبة غير معروف: ${payload.action}` };
  }
  if (!job.organizationId) return { ok: false, error: "المهمة لا تحمل مؤسسة" };

  const router = await getRouterById(payload.routerId);
  if (!router) return { ok: false, error: "الراوتر المرتبط بالمهمة غير موجود" };
  if (router.organizationId !== job.organizationId) {
    return { ok: false, error: "الراوتر لا يتبع لمؤسسة المهمة" };
  }

  const result = await runRouterSystemCommand(router, payload.action as MonitorAction);
  const summary = summarizeMonitorActionResult(result);
  await updateTenantMonitorActionStatus({
    id: payload.logId,
    organizationId: job.organizationId,
    status: summary.status,
    errorMessage: summary.errorMessage,
  });
  return result;
}

async function handleBackupRun(job: Job): Promise<{ ok: boolean; error?: string }> {
  let payload: { organizationId?: number; userId?: number } = {};
  try {
    payload = job.payload ? JSON.parse(job.payload) : {};
  } catch {
    return { ok: false, error: "حمولة المهمة غير صالحة" };
  }
  if (!payload.organizationId || !payload.userId) {
    return { ok: false, error: "المهمة لا تحمل مؤسسة أو منشئًا" };
  }
  if (job.organizationId && payload.organizationId !== job.organizationId) {
    return { ok: false, error: "المهمة لا تتبع لمؤسستها" };
  }
  try {
    await createTenantBackupJob({ organizationId: payload.organizationId, userId: payload.userId, method: "mysqldump" });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "فشل النسخ الاحتياطي" };
  }
}

async function tick() {
  try {
    const job = await claimNextJob();
    if (job) await executeJob(job);
  } catch (error) {
    console.error("[Worker] tick failed:", error);
  }

  ticksSinceCleanup += 1;
  if (ticksSinceCleanup >= CLEANUP_EVERY_N_TICKS) {
    ticksSinceCleanup = 0;
    try {
      const deleted = await cleanupOldJobs();
      if (deleted > 0) console.log(`[Worker] cleaned up ${deleted} terminal job(s) older than 30 days`);
    } catch (error) {
      console.error("[Worker] job cleanup failed:", error);
    }
  }
}

export function startBackgroundJobWorker() {
  if (timer) return;
  timer = setInterval(tick, POLL_INTERVAL_MS);
  console.log(`[Worker] background job worker started (poll every ${POLL_INTERVAL_MS}ms)`);
}

export function stopBackgroundJobWorker() {
  if (timer) clearInterval(timer);
  timer = null;
}
