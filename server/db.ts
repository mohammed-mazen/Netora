import { and, count, desc, eq, inArray, like, ne, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  alertRules,
  apiTokens,
  auditLogs,
  backgroundJobs,
  backupJobs,
  backupSchedules,
  cardDesigns,
  cardImportJobs,
  cashBoxes,
  cashVouchers,
  chartAccounts,
  chatMessages,
  chatThreads,
  competitionEntries,
  competitionQuestions,
  competitions,
  customerPointBalances,
  customerServiceAssignments,
  customers,
  customRoles,
  dynamicSettingsItems,
  files,
  integrationConfigs,
  invoices,
  journalEntries,
  journalLines,
  macSecurityActionLogs,
  macSecurityRules,
  monitorActionLogs,
  monitorSamples,
  monitorSettings,
  networkSessions,
  organizationMembers,
  organizationSubscriptions,
  organizations,
  platformInvoices,
  platformPayments,
  payments,
  pointLedgerEntries,
  pointsBenefitTiers,
  pointsSettings,
  reportBuilderAccess,
  reportCategories,
  reportParameterDefinitions,
  reportSavedFilters,
  reportScheduleDeliveries,
  reportScheduleLogs,
  printJobs,
  reportDefinitions,
  reportExports,
  reportSchedules,
  rolePermissions,
  routers,
  servicePlans,
  hotspotLoginPages,
  sites,
  smsMessages,
  smsSettings,
  speedProfiles,
  stockTransfers,
  subscriptionPlans,
  supportMessages,
  supportTemplates,
  supportTicketDeviceInfo,
  supportTickets,
  smsTemplates,
  type User,
  users,
  voucherBatches,
  voucherBulkActions,
  voucherCategories,
  voucherCategoryPrices,
  voucherGroups,
  vouchers,
  warehouses,
} from "../drizzle/schema";
import { redactAuditMetadata, tenantPermissions, type TenantPermission, type TenantRole } from "./access";
import { addMoney, assertBalancedJournalLines, compareMoney, invoicePointsToAward } from "./financial";
import bcrypt from "bcryptjs";
import { ENV } from './_core/env';
import { ACCOUNT_LOCKOUT_DURATION_MS, ACCOUNT_LOCKOUT_THRESHOLD } from "@shared/const";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

/**
 * Creates a new local account. `passwordHash` must already be a bcrypt hash —
 * this module never hashes/verifies passwords itself (see server/_core/auth.ts).
 * Throws if the email is already registered (unique constraint violation
 * surfaces as a normal DB error, which the auth router maps to a friendly message).
 */
export async function createUserWithPassword(input: { email: string; passwordHash: string; name?: string | null }): Promise<User> {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لإنشاء الحساب");

  const normalizedEmail = input.email.trim().toLowerCase();
  const role = normalizedEmail === ENV.ownerEmail.toLowerCase() && ENV.ownerEmail ? "admin" : "user";

  const result = await db.insert(users).values({
    email: normalizedEmail,
    passwordHash: input.passwordHash,
    name: input.name ?? null,
    role,
    lastSignedIn: new Date(),
  });

  const insertedId = Number(result[0]?.insertId);
  const created = await getUserById(insertedId);
  if (!created) throw new Error("تعذر إنشاء الحساب");
  return created;
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const result = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number): Promise<User | undefined> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function touchUserLastSignedIn(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  // A successful login always clears any prior lockout state, in addition
  // to bumping lastSignedIn — see server/routers/auth.ts login flow.
  await db.update(users).set({ lastSignedIn: new Date(), failedLoginAttempts: 0, lockedUntil: null }).where(eq(users.id, id));
}

/**
 * Records one failed login attempt for brute-force mitigation
 * (server/_core/auth.ts ACCOUNT_LOCKOUT_THRESHOLD/ACCOUNT_LOCKOUT_DURATION_MS).
 * Increments the counter and, once the threshold is crossed, sets
 * `lockedUntil` so subsequent login attempts are rejected until it elapses.
 * Returns the updated attempt count and lock expiry (if any) so the caller
 * can decide whether to surface a "locked" error.
 */
export async function recordFailedLoginAttempt(userId: number): Promise<{ attempts: number; lockedUntil: Date | null }> {
  const db = await getDb();
  if (!db) return { attempts: 0, lockedUntil: null };

  const [current] = await db.select({ failedLoginAttempts: users.failedLoginAttempts }).from(users).where(eq(users.id, userId)).limit(1);
  const attempts = (current?.failedLoginAttempts ?? 0) + 1;
  const lockedUntil = attempts >= ACCOUNT_LOCKOUT_THRESHOLD ? new Date(Date.now() + ACCOUNT_LOCKOUT_DURATION_MS) : null;

  await db.update(users).set({ failedLoginAttempts: attempts, ...(lockedUntil ? { lockedUntil } : {}) }).where(eq(users.id, userId));
  return { attempts, lockedUntil };
}

export type TenantAccess = {
  organizationId: number;
  organizationSlug: string;
  organizationName: string;
  organizationStatus: "trial" | "active" | "suspended" | "archived";
  memberId: number;
  memberRole: TenantRole;
  customRoleId: number | null;
};

/**
 * Resolves access exclusively from the authenticated database user and an organization slug.
 * Client-supplied organization IDs and roles are intentionally never accepted here.
 */
export async function resolveTenantAccess(userId: number, organizationSlug: string): Promise<TenantAccess | null> {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة للتحقق من عضوية المؤسسة");

  const result = await db
    .select({
      organizationId: organizations.id,
      organizationSlug: organizations.slug,
      organizationName: organizations.name,
      organizationStatus: organizations.status,
      memberId: organizationMembers.id,
      memberRole: organizationMembers.role,
      customRoleId: organizationMembers.customRoleId,
    })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
    .where(and(
      eq(organizationMembers.userId, userId),
      eq(organizationMembers.status, "active"),
      eq(organizations.slug, organizationSlug),
    ))
    .limit(1);

  const access = result[0];
  return access ? { ...access, memberRole: access.memberRole as TenantRole, customRoleId: access.customRoleId ?? null } : null;
}

/**
 * Effective permission check used by the new fine-grained modules: grants
 * access if EITHER the base 6-role matrix (server/access.ts) already allows
 * it, OR the member has a custom role (drizzle/schema.ts customRoles /
 * rolePermissions) that explicitly lists the permission. This means custom
 * roles can only ADD capability on top of the base role, never silently
 * remove it — an owner who wants to restrict a user still assigns them a
 * lower base role (e.g. "viewer") and then grants extra permissions via a
 * custom role.
 */
export async function hasEffectiveTenantPermission(tenant: { memberRole: TenantRole; customRoleId: number | null }, permission: TenantPermission): Promise<boolean> {
  const { hasTenantPermission } = await import("./access");
  if (hasTenantPermission(tenant.memberRole, permission)) return true;
  if (!tenant.customRoleId) return false;
  const db = await getDb();
  if (!db) return false;
  const grant = await db.select({ id: rolePermissions.id }).from(rolePermissions)
    .where(and(eq(rolePermissions.roleId, tenant.customRoleId), eq(rolePermissions.permission, permission))).limit(1);
  return Boolean(grant[0]);
}

export async function listActiveTenantMemberships(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة المؤسسات");

  return db
    .select({
      organizationId: organizations.id,
      organizationSlug: organizations.slug,
      organizationName: organizations.name,
      organizationStatus: organizations.status,
      memberRole: organizationMembers.role,
      joinedAt: organizationMembers.createdAt,
    })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
    .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.status, "active")))
    .orderBy(desc(organizations.createdAt));
}

export async function createOrganizationForUser(input: { userId: number; name: string; slug: string; timezone: string; currency: string }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لإنشاء المؤسسة");

  const created = await db.transaction(async tx => {
    const inserted = await tx.insert(organizations).values({
      name: input.name,
      slug: input.slug,
      status: "trial",
      timezone: input.timezone,
      currency: input.currency,
    });
    const organizationId = Number(inserted[0]?.insertId);
    if (!Number.isInteger(organizationId) || organizationId <= 0) throw new Error("تعذر إنشاء معرّف المؤسسة");

    await tx.insert(organizationMembers).values({
      organizationId,
      userId: input.userId,
      role: "owner",
      status: "active",
    });

    return { organizationId, name: input.name, slug: input.slug, status: "trial" as const };
  });

  await recordAuditEvent({
    organizationId: created.organizationId,
    actorUserId: input.userId,
    action: "organization.create",
    resourceType: "organization",
    resourceId: String(created.organizationId),
    requestId: crypto.randomUUID(),
    outcome: "success",
    metadata: { slug: created.slug, status: created.status },
  });

  return created;
}

export async function getTenantOverview(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة الملخص");

  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const [routerStats] = await db.select({
    totalRouters: count(),
    healthyRouters: sql<number>`coalesce(sum(case when ${routers.status} = 'healthy' then 1 else 0 end), 0)`,
  }).from(routers).where(eq(routers.organizationId, organizationId));
  const [sessionStats] = await db.select({
    activeSessions: count(),
  }).from(networkSessions).where(and(eq(networkSessions.organizationId, organizationId), eq(networkSessions.state, "active")));
  const [customerStats] = await db.select({ totalCustomers: count() })
    .from(customers).where(eq(customers.organizationId, organizationId));
  const [financeStats] = await db.select({
    monthlyRevenue: sql<string>`coalesce(sum(case when ${invoices.status} = 'paid' and ${invoices.issuedAt} >= ${monthStart} then ${invoices.total} else 0 end), 0)`,
    openInvoices: sql<number>`coalesce(sum(case when ${invoices.status} in ('issued', 'overdue') then 1 else 0 end), 0)`,
    outstandingBalance: sql<string>`coalesce(sum(case when ${invoices.status} in ('issued', 'overdue') then ${invoices.total} else 0 end), 0)`,
  }).from(invoices).where(eq(invoices.organizationId, organizationId));

  return {
    network: {
      activeSessions: Number(sessionStats?.activeSessions ?? 0),
      healthyRouters: Number(routerStats?.healthyRouters ?? 0),
      totalRouters: Number(routerStats?.totalRouters ?? 0),
    },
    customers: { total: Number(customerStats?.totalCustomers ?? 0) },
    finance: {
      monthlyRevenue: String(financeStats?.monthlyRevenue ?? "0"),
      openInvoices: Number(financeStats?.openInvoices ?? 0),
      outstandingBalance: String(financeStats?.outstandingBalance ?? "0"),
    },
  };
}

export async function getTenantPlanUsage(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة حدود الخطة");
  const [subscription, organization] = await Promise.all([
    db.select({ status: organizationSubscriptions.status, planName: subscriptionPlans.name, routerLimit: subscriptionPlans.routerLimit, customerLimit: subscriptionPlans.customerLimit, storageLimitMb: subscriptionPlans.storageLimitMb, routerOverride: organizationSubscriptions.routerLimitOverride, customerOverride: organizationSubscriptions.customerLimitOverride })
      .from(organizationSubscriptions).innerJoin(subscriptionPlans, eq(organizationSubscriptions.planId, subscriptionPlans.id))
      .where(eq(organizationSubscriptions.organizationId, organizationId)).orderBy(desc(organizationSubscriptions.createdAt)).limit(1),
    db.select({ routerResourceCount: organizations.routerResourceCount, customerResourceCount: organizations.customerResourceCount }).from(organizations).where(eq(organizations.id, organizationId)).limit(1),
  ]);
  const plan = subscription[0]; return {
    subscription: plan ? { planName: plan.planName, status: plan.status } : null,
    resources: {
      routers: { used: organization[0]?.routerResourceCount ?? 0, limit: plan ? plan.routerOverride ?? plan.routerLimit : null },
      customers: { used: organization[0]?.customerResourceCount ?? 0, limit: plan ? plan.customerOverride ?? plan.customerLimit : null },
      storage: { usedMb: null, limitMb: plan?.storageLimitMb ?? null },
    },
  };
}

export async function listActiveSubscriptionPlans() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة الخطط");
  return db.select({ id: subscriptionPlans.id, code: subscriptionPlans.code, name: subscriptionPlans.name, isActive: subscriptionPlans.isActive })
    .from(subscriptionPlans).where(eq(subscriptionPlans.isActive, 1)).orderBy(subscriptionPlans.monthlyPrice);
}

const pageSize = (limit: number) => Math.min(Math.max(limit, 1), 100);
const pageOffset = (offset: number) => Math.max(offset, 0);

export async function listTenantRouters(organizationId: number, options: { search?: string; status?: "pending" | "healthy" | "degraded" | "offline" | "disabled"; limit?: number; offset?: number } = {}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة الراوترات");
  const term = options.search?.trim().slice(0, 120);
  const searchCondition = term ? or(like(routers.name, `%${term}%`), like(routers.managementAddress, `%${term}%`)) : undefined;
  const conditions = searchCondition && options.status ? and(eq(routers.organizationId, organizationId), eq(routers.status, options.status), searchCondition) : searchCondition ? and(eq(routers.organizationId, organizationId), searchCondition) : options.status ? and(eq(routers.organizationId, organizationId), eq(routers.status, options.status)) : eq(routers.organizationId, organizationId);
  return db.select({
    id: routers.id, name: routers.name, managementAddress: routers.managementAddress,
    connectionMode: routers.connectionMode, status: routers.status, routerOsVersion: routers.routerOsVersion,
    lastSeenAt: routers.lastSeenAt, siteName: sites.name,
  }).from(routers).leftJoin(sites, eq(routers.siteId, sites.id))
    .where(conditions).orderBy(desc(routers.createdAt))
    .limit(pageSize(options.limit ?? 25)).offset(pageOffset(options.offset ?? 0));
}

export async function listTenantSites(organizationId: number, options: { search?: string; limit?: number; offset?: number } = {}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة المواقع");
  const term = options.search?.trim().slice(0, 120);
  const conditions = term ? and(eq(sites.organizationId, organizationId), or(like(sites.name, `%${term}%`), like(sites.city, `%${term}%`))) : eq(sites.organizationId, organizationId);
  return db.select({ id: sites.id, name: sites.name, city: sites.city, status: sites.status, createdAt: sites.createdAt })
    .from(sites).where(conditions).orderBy(desc(sites.createdAt)).limit(pageSize(options.limit ?? 25)).offset(pageOffset(options.offset ?? 0));
}

export async function createTenantSite(input: { organizationId: number; name: string; city?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لإنشاء الموقع");
  const result = await db.insert(sites).values({ ...input, city: input.city ?? null, status: "active" });
  return { id: Number(result[0]?.insertId), name: input.name, status: "active" as const };
}

export async function listTenantSpeedProfiles(organizationId: number, options: { search?: string; limit?: number; offset?: number } = {}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة ملفات السرعة");
  const term = options.search?.trim().slice(0, 120);
  const conditions = term ? and(eq(speedProfiles.organizationId, organizationId), like(speedProfiles.name, `%${term}%`)) : eq(speedProfiles.organizationId, organizationId);
  return db.select({ id: speedProfiles.id, name: speedProfiles.name, downloadKbps: speedProfiles.downloadKbps, uploadKbps: speedProfiles.uploadKbps, isActive: speedProfiles.isActive, createdAt: speedProfiles.createdAt })
    .from(speedProfiles).where(conditions).orderBy(desc(speedProfiles.createdAt)).limit(pageSize(options.limit ?? 25)).offset(pageOffset(options.offset ?? 0));
}

export async function createTenantSpeedProfile(input: { organizationId: number; name: string; downloadKbps: number; uploadKbps: number }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لإنشاء ملف السرعة");
  const result = await db.insert(speedProfiles).values({ ...input, isActive: 1 });
  return { id: Number(result[0]?.insertId), name: input.name, isActive: true };
}

async function getTenantCapacityLimit(organizationId: number, resource: "router" | "customer") {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة للتحقق من حدود الخطة");
  const subscription = await db.select({ status: organizationSubscriptions.status, routerLimit: subscriptionPlans.routerLimit, customerLimit: subscriptionPlans.customerLimit, routerOverride: organizationSubscriptions.routerLimitOverride, customerOverride: organizationSubscriptions.customerLimitOverride })
    .from(organizationSubscriptions).innerJoin(subscriptionPlans, eq(organizationSubscriptions.planId, subscriptionPlans.id))
    .where(eq(organizationSubscriptions.organizationId, organizationId)).orderBy(desc(organizationSubscriptions.createdAt)).limit(1);
  const plan = subscription[0];
  if (!plan || (plan.status !== "active" && plan.status !== "trialing")) return null;
  return resource === "router" ? (plan.routerOverride ?? plan.routerLimit) : (plan.customerOverride ?? plan.customerLimit);
}

export async function createTenantRouter(input: {
  organizationId: number; name: string; managementAddress: string; connectionMode: "api_ssl" | "rest_https" | "agent";
  siteId?: number | null; nasIdentifier?: string | null; credentialRef?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لإنشاء الراوتر");
  const limit = await getTenantCapacityLimit(input.organizationId, "router");
  try {
    return await db.transaction(async tx => {
      if (input.siteId) {
        const site = await tx.select({ id: sites.id }).from(sites)
          .where(and(eq(sites.id, input.siteId), eq(sites.organizationId, input.organizationId))).limit(1);
        if (!site[0]) throw new Error("الموقع المحدد لا يتبع للمؤسسة");
      }
      // nasIdentifier is unique PLATFORM-WIDE, not just within this
      // organization (see the schema comment on router_nas_unique) — check
      // explicitly first so a collision with ANOTHER organization's router
      // surfaces as a friendly, non-leaking error instead of a raw MySQL
      // duplicate-key error (which would also be caught below as a fallback).
      if (input.nasIdentifier) {
        const clash = await tx.select({ id: routers.id }).from(routers)
          .where(eq(routers.nasIdentifier, input.nasIdentifier)).limit(1);
        if (clash[0]) throw new Error("معرّف NAS-Identifier مستخدم بالفعل — يجب أن يكون فريدًا على مستوى المنصة بالكامل، جرّب قيمة مختلفة");
      }
      if (limit !== null) {
        const claim = await tx.update(organizations).set({ routerResourceCount: sql`${organizations.routerResourceCount} + 1` })
          .where(and(eq(organizations.id, input.organizationId), sql`${organizations.routerResourceCount} < ${limit}`));
        if (Number(claim[0]?.affectedRows ?? 0) !== 1) throw new Error("تم الوصول إلى حد الراوترات في خطة المؤسسة");
      }
      const result = await tx.insert(routers).values({ ...input, siteId: input.siteId ?? null, nasIdentifier: input.nasIdentifier ?? null, credentialRef: input.credentialRef ?? null, status: "pending" });
      return { id: Number(result[0]?.insertId), name: input.name, status: "pending" as const };
    });
  } catch (error) {
    // Fallback safety net against a race (two concurrent requests picking the
    // same nasIdentifier between the check above and the insert): MySQL's own
    // unique constraint still rejects it, surfaced here as ER_DUP_ENTRY.
    if (error instanceof Error && /ER_DUP_ENTRY/.test(error.message) && /router_nas_unique/.test(error.message)) {
      throw new Error("معرّف NAS-Identifier مستخدم بالفعل — يجب أن يكون فريدًا على مستوى المنصة بالكامل، جرّب قيمة مختلفة");
    }
    throw error;
  }
}

/** Updates a router's NAS-Identifier, enforcing the same platform-wide uniqueness rule as creation. */
export async function updateTenantRouterNasIdentifier(input: { organizationId: number; routerId: number; nasIdentifier: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لتحديث الراوتر");
  try {
    if (input.nasIdentifier) {
      const clash = await db.select({ id: routers.id }).from(routers)
        .where(and(eq(routers.nasIdentifier, input.nasIdentifier), ne(routers.id, input.routerId))).limit(1);
      if (clash[0]) throw new Error("معرّف NAS-Identifier مستخدم بالفعل — يجب أن يكون فريدًا على مستوى المنصة بالكامل، جرّب قيمة مختلفة");
    }
    const result = await db.update(routers).set({ nasIdentifier: input.nasIdentifier })
      .where(and(eq(routers.id, input.routerId), eq(routers.organizationId, input.organizationId)));
    if (Number((result[0] as { affectedRows?: number } | undefined)?.affectedRows ?? 0) !== 1) throw new Error("الراوتر المحدد لا يتبع للمؤسسة");
  } catch (error) {
    if (error instanceof Error && /ER_DUP_ENTRY/.test(error.message) && /router_nas_unique/.test(error.message)) {
      throw new Error("معرّف NAS-Identifier مستخدم بالفعل — يجب أن يكون فريدًا على مستوى المنصة بالكامل، جرّب قيمة مختلفة");
    }
    throw error;
  }
}

/** Fetches a single router's connection details for the background worker (must stay organization-scoped). */
export async function getTenantRouterById(organizationId: number, routerId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة الراوتر");
  const result = await db.select({
    id: routers.id, managementAddress: routers.managementAddress,
    connectionMode: routers.connectionMode, credentialRef: routers.credentialRef,
  }).from(routers).where(and(eq(routers.id, routerId), eq(routers.organizationId, organizationId))).limit(1);
  return result[0] ?? null;
}

/** Same as above but without an organization scope, for worker jobs that only carry a routerId (job.routerId is trusted, set at enqueue time under the tenant procedure). */
export async function getRouterById(routerId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة الراوتر");
  const result = await db.select({
    id: routers.id, organizationId: routers.organizationId, managementAddress: routers.managementAddress,
    connectionMode: routers.connectionMode, credentialRef: routers.credentialRef,
  }).from(routers).where(eq(routers.id, routerId)).limit(1);
  return result[0] ?? null;
}

/** Persists the router's management credential reference after `setRouterCredential` stores the encrypted value. */
export async function updateTenantRouterCredential(input: { organizationId: number; routerId: number; credentialRef: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لتحديث بيانات اعتماد الراوتر");
  const result = await db.update(routers).set({ credentialRef: input.credentialRef })
    .where(and(eq(routers.id, input.routerId), eq(routers.organizationId, input.organizationId)));
  if (Number((result[0] as { affectedRows?: number } | undefined)?.affectedRows ?? 0) !== 1) throw new Error("الراوتر المحدد لا يتبع للمؤسسة");
}

/** Records the outcome of a real health-check operation executed by the background worker. */
export async function updateRouterHealthResult(input: { routerId: number; status: "healthy" | "degraded" | "offline"; routerOsVersion?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لتحديث حالة الراوتر");
  await db.update(routers).set({
    status: input.status,
    routerOsVersion: input.routerOsVersion ?? undefined,
    lastSeenAt: input.status === "offline" ? undefined : new Date(),
  }).where(eq(routers.id, input.routerId));
}

/**
 * Resolves the router (and its organization) that owns a given RADIUS
 * NAS-Identifier. `nasIdentifier` should be provisioned as globally unique
 * across the whole platform's routers (not just per-organization) so a raw
 * RADIUS accounting packet — which carries no organization/tenant context —
 * can be routed to the correct tenant. This is documented in the RADIUS
 * accounting setup notes in the README.
 */
export async function getRouterByNasIdentifier(nasIdentifier: string) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لتحديد الراوتر");
  const result = await db.select({ id: routers.id, organizationId: routers.organizationId })
    .from(routers).where(eq(routers.nasIdentifier, nasIdentifier)).limit(1);
  return result[0] ?? null;
}

export async function findTenantCustomerByUsername(organizationId: number, username: string) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة العميل");
  const result = await db.select({ id: customers.id }).from(customers)
    .where(and(eq(customers.organizationId, organizationId), eq(customers.username, username))).limit(1);
  return result[0] ?? null;
}

/**
 * Applies a RADIUS accounting event (Start/Interim-Update/Stop) to the
 * `network_sessions` table, upserted by (organizationId, acctUniqueId) per
 * the table's unique index. Start creates the row; Interim-Update refreshes
 * counters/timestamp; Stop closes it and records final counters.
 */
export async function applyRadiusAccountingEvent(input: {
  organizationId: number; routerId: number; customerId: number | null;
  acctUniqueId: string; protocol: "hotspot" | "pppoe";
  statusType: "start" | "interim-update" | "stop";
  inputOctets: string; outputOctets: string; eventTime: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لتسجيل حدث RADIUS");

  const existing = await db.select({ id: networkSessions.id }).from(networkSessions)
    .where(and(eq(networkSessions.organizationId, input.organizationId), eq(networkSessions.acctUniqueId, input.acctUniqueId))).limit(1);

  if (input.statusType === "start") {
    if (existing[0]) {
      await db.update(networkSessions).set({
        state: "active", inputOctets: input.inputOctets, outputOctets: input.outputOctets, lastUpdateAt: input.eventTime,
      }).where(eq(networkSessions.id, existing[0].id));
      return { id: existing[0].id, action: "updated" as const };
    }
    const result = await db.insert(networkSessions).values({
      organizationId: input.organizationId, routerId: input.routerId, customerId: input.customerId,
      acctUniqueId: input.acctUniqueId, protocol: input.protocol, state: "active",
      inputOctets: input.inputOctets, outputOctets: input.outputOctets,
      startedAt: input.eventTime, lastUpdateAt: input.eventTime,
    });
    return { id: Number(result[0]?.insertId), action: "created" as const };
  }

  if (!existing[0]) {
    // Interim-Update/Stop arriving without a prior Start (e.g. worker restart
    // mid-session) — create the row defensively so accounting data isn't lost.
    const result = await db.insert(networkSessions).values({
      organizationId: input.organizationId, routerId: input.routerId, customerId: input.customerId,
      acctUniqueId: input.acctUniqueId, protocol: input.protocol,
      state: input.statusType === "stop" ? "closed" : "active",
      inputOctets: input.inputOctets, outputOctets: input.outputOctets,
      startedAt: input.eventTime, lastUpdateAt: input.eventTime,
      ...(input.statusType === "stop" ? { stoppedAt: input.eventTime } : {}),
    });
    return { id: Number(result[0]?.insertId), action: "created" as const };
  }

  await db.update(networkSessions).set({
    state: input.statusType === "stop" ? "closed" : "active",
    inputOctets: input.inputOctets, outputOctets: input.outputOctets,
    lastUpdateAt: input.eventTime,
    ...(input.statusType === "stop" ? { stoppedAt: input.eventTime } : {}),
  }).where(eq(networkSessions.id, existing[0].id));
  return { id: existing[0].id, action: "updated" as const };
}

export async function listTenantCustomers(organizationId: number, search?: string, status?: "active" | "suspended" | "blocked" | "archived", limit = 25, offset = 0) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة العملاء");
  const terms = search?.trim().slice(0, 120);
  const searchCondition = terms ? or(like(customers.fullName, `%${terms}%`), like(customers.username, `%${terms}%`), like(customers.phone, `%${terms}%`)) : undefined;
  const conditions = searchCondition && status ? and(eq(customers.organizationId, organizationId), eq(customers.status, status), searchCondition) : searchCondition ? and(eq(customers.organizationId, organizationId), searchCondition) : status ? and(eq(customers.organizationId, organizationId), eq(customers.status, status)) : eq(customers.organizationId, organizationId);
  return db.select({ id: customers.id, fullName: customers.fullName, username: customers.username, phone: customers.phone, email: customers.email, status: customers.status, createdAt: customers.createdAt, servicePlanName: servicePlans.name, servicePlanId: servicePlans.id })
    .from(customers).leftJoin(customerServiceAssignments, and(eq(customerServiceAssignments.organizationId, customers.organizationId), eq(customerServiceAssignments.customerId, customers.id), eq(customerServiceAssignments.activeKey, "active"))).leftJoin(servicePlans, eq(customerServiceAssignments.servicePlanId, servicePlans.id)).where(conditions).orderBy(desc(customers.createdAt)).limit(pageSize(limit)).offset(pageOffset(offset));
}

export async function createTenantCustomer(input: { organizationId: number; fullName: string; username: string; phone?: string | null; email?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لإنشاء العميل");
  const limit = await getTenantCapacityLimit(input.organizationId, "customer");
  return db.transaction(async tx => {
    if (limit !== null) {
      const claim = await tx.update(organizations).set({ customerResourceCount: sql`${organizations.customerResourceCount} + 1` })
        .where(and(eq(organizations.id, input.organizationId), sql`${organizations.customerResourceCount} < ${limit}`));
      if (Number(claim[0]?.affectedRows ?? 0) !== 1) throw new Error("تم الوصول إلى حد العملاء في خطة المؤسسة");
    }
    const result = await tx.insert(customers).values({ ...input, phone: input.phone ?? null, email: input.email ?? null, status: "active" });
    return { id: Number(result[0]?.insertId), fullName: input.fullName, username: input.username, status: "active" as const };
  });
}

const customerStatusTransitions = {
  active: ["suspended", "blocked", "archived"],
  suspended: ["active", "blocked", "archived"],
  blocked: ["active", "archived"],
  archived: [],
} as const;

export async function updateTenantCustomerStatus(input: { organizationId: number; customerId: number; status: "active" | "suspended" | "blocked" | "archived" }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لتحديث العميل");
  return db.transaction(async tx => {
    const current = await tx.select({ status: customers.status }).from(customers).where(and(eq(customers.id, input.customerId), eq(customers.organizationId, input.organizationId))).limit(1);
    const currentStatus = current[0]?.status;
    if (!currentStatus) throw new Error("العميل غير موجود في المؤسسة الحالية");
    if (currentStatus === input.status) return { id: input.customerId, status: input.status, changed: false };
    if (!customerStatusTransitions[currentStatus].includes(input.status as never)) throw new Error("انتقال حالة العميل غير مسموح");
    const result = await tx.update(customers).set({ status: input.status }).where(and(eq(customers.id, input.customerId), eq(customers.organizationId, input.organizationId), eq(customers.status, currentStatus)));
    if (Number(result[0]?.affectedRows ?? 0) !== 1) throw new Error("تغيرت حالة العميل قبل إتمام الطلب؛ أعد المحاولة");
    return { id: input.customerId, status: input.status, changed: true };
  });
}

export async function assignTenantCustomerServicePlan(input: { organizationId: number; customerId: number; servicePlanId: number; createdByUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لإسناد الباقة");
  return db.transaction(async tx => {
    const [customer, plan] = await Promise.all([
      tx.select({ id: customers.id, status: customers.status }).from(customers).where(and(eq(customers.id, input.customerId), eq(customers.organizationId, input.organizationId))).limit(1),
      tx.select({ id: servicePlans.id, name: servicePlans.name, status: servicePlans.status }).from(servicePlans).where(and(eq(servicePlans.id, input.servicePlanId), eq(servicePlans.organizationId, input.organizationId))).limit(1),
    ]);
    if (!customer[0]) throw new Error("العميل غير موجود في المؤسسة الحالية");
    if (customer[0].status === "archived") throw new Error("لا يمكن إسناد باقة إلى عميل مؤرشف");
    if (!plan[0] || plan[0].status !== "active") throw new Error("يجب اختيار باقة مفعلة تابعة للمؤسسة");
    const now = new Date();
    await tx.update(customerServiceAssignments).set({ status: "ended", activeKey: null, endsAt: now }).where(and(eq(customerServiceAssignments.organizationId, input.organizationId), eq(customerServiceAssignments.customerId, input.customerId), eq(customerServiceAssignments.activeKey, "active")));
    const result = await tx.insert(customerServiceAssignments).values({ organizationId: input.organizationId, customerId: input.customerId, servicePlanId: input.servicePlanId, status: "active", activeKey: "active", createdByUserId: input.createdByUserId });
    return { id: Number(result[0]?.insertId), customerId: input.customerId, servicePlanId: plan[0].id, servicePlanName: plan[0].name, status: "active" as const };
  });
}

export async function listTenantServicePlans(organizationId: number, options: { search?: string; status?: "draft" | "active" | "archived"; limit?: number; offset?: number } = {}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة الباقات");
  const term = options.search?.trim().slice(0, 120);
  const searchCondition = term ? or(like(servicePlans.name, `%${term}%`), like(speedProfiles.name, `%${term}%`)) : undefined;
  const conditions = searchCondition && options.status ? and(eq(servicePlans.organizationId, organizationId), eq(servicePlans.status, options.status), searchCondition) : searchCondition ? and(eq(servicePlans.organizationId, organizationId), searchCondition) : options.status ? and(eq(servicePlans.organizationId, organizationId), eq(servicePlans.status, options.status)) : eq(servicePlans.organizationId, organizationId);
  return db.select({ id: servicePlans.id, name: servicePlans.name, type: servicePlans.type, price: servicePlans.price, validityDays: servicePlans.validityDays, quotaMb: servicePlans.quotaMb, simultaneousSessions: servicePlans.simultaneousSessions, status: servicePlans.status, speedProfileName: speedProfiles.name })
    .from(servicePlans).leftJoin(speedProfiles, eq(servicePlans.speedProfileId, speedProfiles.id))
    .where(conditions).orderBy(desc(servicePlans.createdAt)).limit(pageSize(options.limit ?? 25)).offset(pageOffset(options.offset ?? 0));
}

export async function createTenantServicePlan(input: {
  organizationId: number; name: string; type: "voucher" | "subscription" | "pppoe"; price: string;
  validityDays?: number | null; quotaMb?: number | null; simultaneousSessions: number; speedProfileId?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لإنشاء الباقة");
  if (input.speedProfileId) {
    const profile = await db.select({ id: speedProfiles.id }).from(speedProfiles)
      .where(and(eq(speedProfiles.id, input.speedProfileId), eq(speedProfiles.organizationId, input.organizationId))).limit(1);
    if (!profile[0]) throw new Error("ملف السرعة المحدد لا يتبع للمؤسسة");
  }
  const result = await db.insert(servicePlans).values({ ...input, validityDays: input.validityDays ?? null, quotaMb: input.quotaMb ?? null, speedProfileId: input.speedProfileId ?? null, status: "draft" });
  return { id: Number(result[0]?.insertId), name: input.name, status: "draft" as const };
}

export async function activateTenantServicePlan(input: { organizationId: number; servicePlanId: number }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لتفعيل الباقة");
  const plan = await db.select({ id: servicePlans.id, name: servicePlans.name, status: servicePlans.status }).from(servicePlans)
    .where(and(eq(servicePlans.id, input.servicePlanId), eq(servicePlans.organizationId, input.organizationId))).limit(1);
  if (!plan[0]) throw new Error("الباقة المحددة لا تتبع للمؤسسة");
  if (plan[0].status === "archived") throw new Error("لا يمكن تفعيل باقة مؤرشفة");
  await db.update(servicePlans).set({ status: "active" }).where(and(eq(servicePlans.id, input.servicePlanId), eq(servicePlans.organizationId, input.organizationId)));
  return { id: plan[0].id, name: plan[0].name, status: "active" as const };
}

export async function listTenantVouchers(organizationId: number, limit = 25, offset = 0) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة البطاقات");
  return db.select({ id: vouchers.id, serial: vouchers.serial, status: vouchers.status, expiresAt: vouchers.expiresAt, soldAt: vouchers.soldAt, activatedAt: vouchers.activatedAt, planName: servicePlans.name })
    .from(vouchers).innerJoin(servicePlans, eq(vouchers.servicePlanId, servicePlans.id))
    .where(eq(vouchers.organizationId, organizationId)).orderBy(desc(vouchers.createdAt)).limit(pageSize(limit)).offset(pageOffset(offset));
}

export async function listTenantVoucherBatches(organizationId: number, options: { limit?: number; offset?: number; search?: string; status?: "draft" | "generated" | "printed" | "cancelled" } = {}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة دفعات البطاقات");
  const terms = options.search?.trim().slice(0, 80);
  const conditions = terms && options.status ? and(eq(voucherBatches.organizationId, organizationId), eq(voucherBatches.status, options.status), like(voucherBatches.reference, `%${terms}%`)) : terms ? and(eq(voucherBatches.organizationId, organizationId), like(voucherBatches.reference, `%${terms}%`)) : options.status ? and(eq(voucherBatches.organizationId, organizationId), eq(voucherBatches.status, options.status)) : eq(voucherBatches.organizationId, organizationId);
  return db.select({ id: voucherBatches.id, reference: voucherBatches.reference, quantity: voucherBatches.quantity, status: voucherBatches.status, generatedAt: voucherBatches.generatedAt, printedAt: voucherBatches.printedAt, createdAt: voucherBatches.createdAt, planName: servicePlans.name })
    .from(voucherBatches).innerJoin(servicePlans, eq(voucherBatches.servicePlanId, servicePlans.id))
    .where(conditions).orderBy(desc(voucherBatches.createdAt)).limit(pageSize(options.limit ?? 25)).offset(pageOffset(options.offset ?? 0));
}

function newVoucherCode() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 20).toUpperCase();
}

async function hashVoucherCode(code: string) {
  const bytes = new TextEncoder().encode(code);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Buffer.from(digest).toString("hex");
}

export async function createTenantVoucherBatch(input: { organizationId: number; userId: number; servicePlanId: number; quantity: number }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لإصدار البطاقات");
  const plan = await db.select({ id: servicePlans.id, name: servicePlans.name, status: servicePlans.status }).from(servicePlans)
    .where(and(eq(servicePlans.id, input.servicePlanId), eq(servicePlans.organizationId, input.organizationId))).limit(1);
  if (!plan[0]) throw new Error("الباقة المحددة لا تتبع للمؤسسة");
  if (plan[0].status !== "active") throw new Error("يجب تفعيل الباقة قبل إصدار البطاقات");

  const codes = Array.from({ length: input.quantity }, newVoucherCode);
  const hashes = await Promise.all(codes.map(hashVoucherCode));
  const reference = `VCH-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const created = await db.transaction(async tx => {
    const batchResult = await tx.insert(voucherBatches).values({ organizationId: input.organizationId, servicePlanId: input.servicePlanId, reference, quantity: input.quantity, status: "generated", createdByUserId: input.userId, generatedAt: new Date() });
    const batchId = Number(batchResult[0]?.insertId);
    if (!Number.isInteger(batchId) || batchId <= 0) throw new Error("تعذر إنشاء دفعة البطاقات");
    const serialWidth = Math.max(4, String(input.quantity).length);
    await tx.insert(vouchers).values(codes.map((code, index) => ({
      organizationId: input.organizationId,
      servicePlanId: input.servicePlanId,
      codeHash: hashes[index],
      serial: `${reference}-${String(index + 1).padStart(serialWidth, "0")}`,
      status: "new" as const,
    })));
    return { batchId };
  });
  return { batchId: created.batchId, reference, quantity: input.quantity, planName: plan[0].name, codes };
}

export async function markTenantVoucherBatchPrinted(input: { organizationId: number; batchId: number }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لتسجيل الطباعة");
  const batch = await db.select({ id: voucherBatches.id, reference: voucherBatches.reference }).from(voucherBatches)
    .where(and(eq(voucherBatches.id, input.batchId), eq(voucherBatches.organizationId, input.organizationId))).limit(1);
  if (!batch[0]) throw new Error("دفعة البطاقات لا تتبع للمؤسسة");
  await db.update(voucherBatches).set({ status: "printed", printedAt: new Date() })
    .where(and(eq(voucherBatches.id, input.batchId), eq(voucherBatches.organizationId, input.organizationId)));
  return { id: batch[0].id, reference: batch[0].reference, status: "printed" as const };
}

export async function listTenantSessions(organizationId: number, options: { limit?: number; offset?: number; search?: string; state?: "active" | "closed" | "unknown" } = {}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة الجلسات");
  const terms = options.search?.trim().slice(0, 120);
  const searchCondition = terms ? or(like(routers.name, `%${terms}%`), like(customers.fullName, `%${terms}%`), like(networkSessions.acctUniqueId, `%${terms}%`)) : undefined;
  const conditions = searchCondition && options.state ? and(eq(networkSessions.organizationId, organizationId), eq(networkSessions.state, options.state), searchCondition) : searchCondition ? and(eq(networkSessions.organizationId, organizationId), searchCondition) : options.state ? and(eq(networkSessions.organizationId, organizationId), eq(networkSessions.state, options.state)) : eq(networkSessions.organizationId, organizationId);
  return db.select({ id: networkSessions.id, protocol: networkSessions.protocol, state: networkSessions.state, inputOctets: networkSessions.inputOctets, outputOctets: networkSessions.outputOctets, startedAt: networkSessions.startedAt, lastUpdateAt: networkSessions.lastUpdateAt, routerName: routers.name, customerName: customers.fullName })
    .from(networkSessions).innerJoin(routers, eq(networkSessions.routerId, routers.id)).leftJoin(customers, eq(networkSessions.customerId, customers.id))
    .where(conditions).orderBy(desc(networkSessions.lastUpdateAt)).limit(pageSize(options.limit ?? 25)).offset(pageOffset(options.offset ?? 0));
}

/** Fetches session + customer identifiers needed to issue a real disconnect on the router (used by the background worker). */
export async function getSessionForDisconnect(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة الجلسة");
  const result = await db.select({
    id: networkSessions.id, routerId: networkSessions.routerId, protocol: networkSessions.protocol,
    state: networkSessions.state, customerUsername: customers.username,
  }).from(networkSessions).leftJoin(customers, eq(networkSessions.customerId, customers.id))
    .where(eq(networkSessions.id, sessionId)).limit(1);
  return result[0] ?? null;
}

/** Marks a session closed once the router confirms the disconnect (or RADIUS Stop record arrives). */
export async function markSessionClosed(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لإغلاق الجلسة");
  await db.update(networkSessions).set({ state: "closed", stoppedAt: new Date() }).where(eq(networkSessions.id, sessionId));
}

export async function enqueueTenantSessionDisconnect(input: { organizationId: number; sessionId: number }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لطلب قطع الجلسة");
  const session = await db.select({ id: networkSessions.id, routerId: networkSessions.routerId, state: networkSessions.state }).from(networkSessions)
    .where(and(eq(networkSessions.id, input.sessionId), eq(networkSessions.organizationId, input.organizationId))).limit(1);
  if (!session[0]) throw new Error("الجلسة المحددة لا تتبع للمؤسسة");
  if (session[0].state !== "active") throw new Error("لا يمكن طلب قطع جلسة غير نشطة");
  const config = await db.select({ id: integrationConfigs.id }).from(integrationConfigs).where(and(eq(integrationConfigs.organizationId, input.organizationId), eq(integrationConfigs.kind, "radius"))).limit(1);
  if (!config[0]) throw new Error("لا يوجد إعداد RADIUS للمؤسسة لإضافة طلب القطع");
  const idempotencyKey = `radius_disconnect:${input.organizationId}:${input.sessionId}:${crypto.randomUUID()}`;
  const result = await db.insert(backgroundJobs).values({ organizationId: input.organizationId, routerId: session[0].routerId, type: "radius_disconnect_session", idempotencyKey, status: "queued", payload: JSON.stringify({ operation: "radius_disconnect_session", sessionId: input.sessionId, routerId: session[0].routerId }) });
  return { id: Number(result[0]?.insertId), status: "queued" as const };
}

export async function listTenantSupportTickets(organizationId: number, options: { limit?: number; offset?: number; search?: string; status?: "open" | "pending" | "resolved" | "closed" } = {}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة التذاكر");
  const terms = options.search?.trim().slice(0, 120);
  const searchCondition = terms ? or(like(supportTickets.reference, `%${terms}%`), like(supportTickets.subject, `%${terms}%`)) : undefined;
  const conditions = searchCondition && options.status ? and(eq(supportTickets.organizationId, organizationId), eq(supportTickets.status, options.status), searchCondition) : searchCondition ? and(eq(supportTickets.organizationId, organizationId), searchCondition) : options.status ? and(eq(supportTickets.organizationId, organizationId), eq(supportTickets.status, options.status)) : eq(supportTickets.organizationId, organizationId);
  return db.select({ id: supportTickets.id, reference: supportTickets.reference, subject: supportTickets.subject, priority: supportTickets.priority, status: supportTickets.status, createdAt: supportTickets.createdAt, updatedAt: supportTickets.updatedAt })
    .from(supportTickets).where(conditions).orderBy(desc(supportTickets.updatedAt)).limit(pageSize(options.limit ?? 25)).offset(pageOffset(options.offset ?? 0));
}

export async function createTenantSupportTicket(input: { organizationId: number; userId: number; reference: string; subject: string; priority: "low" | "normal" | "high" | "critical" }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لإنشاء التذكرة");
  const result = await db.insert(supportTickets).values({ ...input, status: "open" });
  return { id: Number(result[0]?.insertId), reference: input.reference, status: "open" as const };
}

const ticketTransitions = {
  open: ["pending", "resolved", "closed"],
  pending: ["open", "resolved", "closed"],
  resolved: ["open", "closed"],
  closed: [],
} as const;

export async function updateTenantSupportTicketStatus(input: { organizationId: number; ticketId: number; status: "open" | "pending" | "resolved" | "closed" }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لتحديث التذكرة");
  return db.transaction(async tx => {
    const current = await tx.select({ status: supportTickets.status }).from(supportTickets)
      .where(and(eq(supportTickets.id, input.ticketId), eq(supportTickets.organizationId, input.organizationId))).limit(1);
    const currentStatus = current[0]?.status;
    if (!currentStatus) throw new Error("التذكرة غير موجودة في المؤسسة الحالية");
    if (currentStatus === input.status) return { id: input.ticketId, status: input.status, changed: false };
    if (!ticketTransitions[currentStatus].includes(input.status as never)) throw new Error("انتقال حالة التذكرة غير مسموح");
    const result = await tx.update(supportTickets).set({ status: input.status }).where(and(eq(supportTickets.id, input.ticketId), eq(supportTickets.organizationId, input.organizationId), eq(supportTickets.status, currentStatus)));
    if (Number(result[0]?.affectedRows ?? 0) !== 1) throw new Error("تغيرت حالة التذكرة قبل إتمام الطلب؛ أعد المحاولة");
    return { id: input.ticketId, status: input.status, changed: true };
  });
}

export async function listTenantSupportMessages(organizationId: number, ticketId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة رسائل التذكرة");
  return db.select({ id: supportMessages.id, body: supportMessages.body, createdAt: supportMessages.createdAt, authorName: users.name })
    .from(supportMessages).leftJoin(users, eq(supportMessages.authorUserId, users.id))
    .where(and(eq(supportMessages.organizationId, organizationId), eq(supportMessages.ticketId, ticketId))).orderBy(desc(supportMessages.createdAt));
}

export async function createTenantSupportMessage(input: { organizationId: number; userId: number; ticketId: number; body: string }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لإضافة رسالة التذكرة");
  const ticket = await db.select({ id: supportTickets.id, status: supportTickets.status }).from(supportTickets)
    .where(and(eq(supportTickets.id, input.ticketId), eq(supportTickets.organizationId, input.organizationId))).limit(1);
  if (!ticket[0]) throw new Error("التذكرة المحددة لا تتبع للمؤسسة");
  if (ticket[0].status === "closed") throw new Error("لا يمكن إضافة رسالة إلى تذكرة مغلقة");
  const result = await db.insert(supportMessages).values(input);
  await db.update(supportTickets).set({ status: ticket[0].status === "open" ? "pending" : ticket[0].status }).where(and(eq(supportTickets.id, input.ticketId), eq(supportTickets.organizationId, input.organizationId)));
  return { id: Number(result[0]?.insertId), ticketId: input.ticketId };
}

export async function listTenantSupportTemplates(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة قوالب الدعم");
  return db.select({ id: supportTemplates.id, name: supportTemplates.name, body: supportTemplates.body, createdAt: supportTemplates.createdAt, updatedAt: supportTemplates.updatedAt })
    .from(supportTemplates).where(eq(supportTemplates.organizationId, organizationId)).orderBy(desc(supportTemplates.updatedAt));
}

export async function createTenantSupportTemplate(input: { organizationId: number; userId: number; name: string; body: string }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لإنشاء قالب الدعم");
  const result = await db.insert(supportTemplates).values({ organizationId: input.organizationId, createdByUserId: input.userId, name: input.name, body: input.body });
  return { id: Number(result[0]?.insertId), name: input.name };
}

export async function listTenantAlertRules(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة قواعد التنبيه");
  return db.select({ id: alertRules.id, key: alertRules.key, severity: alertRules.severity, isEnabled: alertRules.isEnabled, createdAt: alertRules.createdAt })
    .from(alertRules).where(eq(alertRules.organizationId, organizationId)).orderBy(desc(alertRules.createdAt));
}

export async function saveTenantAlertRule(input: { organizationId: number; userId: number; key: string; severity: "info" | "warning" | "critical"; isEnabled: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لحفظ قاعدة التنبيه");
  await db.insert(alertRules).values({ organizationId: input.organizationId, key: input.key, severity: input.severity, isEnabled: input.isEnabled ? 1 : 0, createdByUserId: input.userId })
    .onDuplicateKeyUpdate({ set: { severity: input.severity, isEnabled: input.isEnabled ? 1 : 0 } });
  return { key: input.key, severity: input.severity, isEnabled: input.isEnabled };
}

export async function listTenantIntegrations(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة التكاملات");
  return db.select({ kind: integrationConfigs.kind, status: integrationConfigs.status, lastCheckedAt: integrationConfigs.lastCheckedAt, updatedAt: integrationConfigs.updatedAt })
    .from(integrationConfigs).where(eq(integrationConfigs.organizationId, organizationId));
}

export async function listTenantAuditLogs(organizationId: number, options: { limit?: number; offset?: number; search?: string; outcome?: "success" | "denied" | "failed" } = {}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة سجل التدقيق");
  const terms = options.search?.trim().slice(0, 120);
  const searchCondition = terms ? or(like(auditLogs.action, `%${terms}%`), like(auditLogs.resourceType, `%${terms}%`), like(auditLogs.resourceId, `%${terms}%`)) : undefined;
  const conditions = searchCondition && options.outcome ? and(eq(auditLogs.organizationId, organizationId), eq(auditLogs.outcome, options.outcome), searchCondition) : searchCondition ? and(eq(auditLogs.organizationId, organizationId), searchCondition) : options.outcome ? and(eq(auditLogs.organizationId, organizationId), eq(auditLogs.outcome, options.outcome)) : eq(auditLogs.organizationId, organizationId);
  return db.select({ id: auditLogs.id, action: auditLogs.action, resourceType: auditLogs.resourceType, resourceId: auditLogs.resourceId, outcome: auditLogs.outcome, createdAt: auditLogs.createdAt, actorName: users.name })
    .from(auditLogs).leftJoin(users, eq(auditLogs.actorUserId, users.id)).where(conditions).orderBy(desc(auditLogs.createdAt)).limit(pageSize(options.limit ?? 25)).offset(pageOffset(options.offset ?? 0));
}

export async function getTenantReportSummary(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لإنشاء ملخص التقرير");
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const [routerRows, customerRows, sessionRows, invoiceRows, ticketRows] = await Promise.all([
    db.select({ status: routers.status }).from(routers).where(eq(routers.organizationId, organizationId)),
    db.select({ status: customers.status }).from(customers).where(eq(customers.organizationId, organizationId)),
    db.select({ state: networkSessions.state }).from(networkSessions).where(eq(networkSessions.organizationId, organizationId)),
    db.select({ status: invoices.status, total: invoices.total, issuedAt: invoices.issuedAt }).from(invoices).where(eq(invoices.organizationId, organizationId)),
    db.select({ status: supportTickets.status }).from(supportTickets).where(eq(supportTickets.organizationId, organizationId)),
  ]);
  const total = (rows: Array<{ total: string }>) => rows.reduce((sum, row) => sum + Number(row.total), 0).toFixed(2);
  return {
    generatedAt: new Date(),
    routers: { total: routerRows.length, healthy: routerRows.filter(row => row.status === "healthy").length, attention: routerRows.filter(row => row.status === "degraded" || row.status === "offline").length },
    customers: { total: customerRows.length, active: customerRows.filter(row => row.status === "active").length },
    sessions: { total: sessionRows.length, active: sessionRows.filter(row => row.state === "active").length },
    billing: { issuedThisMonth: total(invoiceRows.filter(row => row.issuedAt && row.issuedAt >= monthStart && row.status !== "draft")), outstanding: total(invoiceRows.filter(row => row.status === "issued" || row.status === "overdue")), paidInvoices: invoiceRows.filter(row => row.status === "paid").length },
    support: { open: ticketRows.filter(row => row.status === "open" || row.status === "pending").length },
  };
}

export async function listTenantJournalEntries(organizationId: number, options: { limit?: number; offset?: number; search?: string } = {}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة دفتر القيود");
  const term = options.search?.trim().slice(0, 120);
  const conditions = term
    ? and(eq(journalEntries.organizationId, organizationId), or(like(journalEntries.number, `%${term}%`), like(journalEntries.description, `%${term}%`)))
    : eq(journalEntries.organizationId, organizationId);
  const entries = await db.select({ id: journalEntries.id, number: journalEntries.number, description: journalEntries.description, occurredAt: journalEntries.occurredAt, createdAt: journalEntries.createdAt })
    .from(journalEntries).where(conditions).orderBy(desc(journalEntries.occurredAt)).limit(pageSize(options.limit ?? 25)).offset(pageOffset(options.offset ?? 0));
  return Promise.all(entries.map(async entry => {
    const lines = await db.select({ debit: journalLines.debit, credit: journalLines.credit }).from(journalLines).where(eq(journalLines.journalEntryId, entry.id));
    return { ...entry, debit: lines.reduce((sum, line) => sum + Number(line.debit), 0).toFixed(2), credit: lines.reduce((sum, line) => sum + Number(line.credit), 0).toFixed(2), lineCount: lines.length };
  }));
}

export async function saveTenantIntegrationDraft(input: { organizationId: number; kind: "radius" | "mikrotik"; secretRef: string | null; configuration: Record<string, unknown> }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لحفظ إعداد التكامل");
  await db.insert(integrationConfigs).values({ organizationId: input.organizationId, kind: input.kind, secretRef: input.secretRef, configuration: JSON.stringify(input.configuration), status: "not_configured" })
    .onDuplicateKeyUpdate({ set: { secretRef: input.secretRef, configuration: JSON.stringify(input.configuration), status: "not_configured" } });
  return { kind: input.kind, status: "not_configured" as const, secretConfigured: Boolean(input.secretRef) };
}

export async function enqueueTenantIntegrationJob(input: { organizationId: number; kind: "radius" | "mikrotik"; type: string; payload: Record<string, unknown>; routerId?: number | null }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لإضافة مهمة التكامل");
  const config = await db.select({ id: integrationConfigs.id }).from(integrationConfigs)
    .where(and(eq(integrationConfigs.organizationId, input.organizationId), eq(integrationConfigs.kind, input.kind))).limit(1);
  if (!config[0]) throw new Error("احفظ مسودة إعداد التكامل قبل إضافة مهمة");
  const idempotencyKey = `${input.kind}:${input.type}:${input.organizationId}:${crypto.randomUUID()}`;
  const result = await db.insert(backgroundJobs).values({ organizationId: input.organizationId, routerId: input.routerId ?? null, type: input.type, idempotencyKey, status: "queued", payload: JSON.stringify(input.payload) });
  return { id: Number(result[0]?.insertId), status: "queued" as const };
}

/** Platform view: intentionally excludes customer, session, credential, and integration-configuration data. */
export async function listPlatformOrganizations(options: { limit?: number; offset?: number; search?: string } = {}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة مؤسسات المنصة");
  const term = options.search?.trim().slice(0, 120);
  const conditions = term ? or(like(organizations.name, `%${term}%`), like(organizations.slug, `%${term}%`)) : undefined;
  return db.select({
    id: organizations.id,
    name: organizations.name,
    slug: organizations.slug,
    status: organizations.status,
    timezone: organizations.timezone,
    createdAt: organizations.createdAt,
    subscriptionStatus: organizationSubscriptions.status,
    planName: subscriptionPlans.name,
  }).from(organizations)
    .leftJoin(organizationSubscriptions, eq(organizationSubscriptions.organizationId, organizations.id))
    .leftJoin(subscriptionPlans, eq(organizationSubscriptions.planId, subscriptionPlans.id))
    .where(conditions).orderBy(desc(organizations.createdAt)).limit(pageSize(options.limit ?? 25)).offset(pageOffset(options.offset ?? 0));
}

export async function listPlatformSubscriptionPlans(options: { limit?: number; offset?: number; search?: string } = {}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة خطط المنصة");
  const term = options.search?.trim().slice(0, 120);
  const conditions = term ? or(like(subscriptionPlans.name, `%${term}%`), like(subscriptionPlans.code, `%${term}%`)) : undefined;
  return db.select().from(subscriptionPlans).where(conditions).orderBy(desc(subscriptionPlans.createdAt)).limit(pageSize(options.limit ?? 25)).offset(pageOffset(options.offset ?? 0));
}

export async function listPlatformOrganizationSubscriptions(options: { limit?: number; offset?: number; search?: string; status?: "trialing" | "active" | "past_due" | "suspended" | "cancelled" } = {}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة اشتراكات المؤسسات");
  const term = options.search?.trim().slice(0, 120);
  const searchCondition = term ? or(like(organizations.name, `%${term}%`), like(organizations.slug, `%${term}%`), like(subscriptionPlans.name, `%${term}%`), like(subscriptionPlans.code, `%${term}%`)) : undefined;
  const conditions = searchCondition && options.status ? and(eq(organizationSubscriptions.status, options.status), searchCondition) : searchCondition ? searchCondition : options.status ? eq(organizationSubscriptions.status, options.status) : undefined;
  return db.select({ id: organizationSubscriptions.id, status: organizationSubscriptions.status, startedAt: organizationSubscriptions.startedAt, endsAt: organizationSubscriptions.endsAt, organizationName: organizations.name, organizationSlug: organizations.slug, planName: subscriptionPlans.name, planCode: subscriptionPlans.code })
    .from(organizationSubscriptions).innerJoin(organizations, eq(organizationSubscriptions.organizationId, organizations.id)).innerJoin(subscriptionPlans, eq(organizationSubscriptions.planId, subscriptionPlans.id))
    .where(conditions).orderBy(desc(organizationSubscriptions.createdAt)).limit(pageSize(options.limit ?? 25)).offset(pageOffset(options.offset ?? 0));
}

export async function listPlatformSupportTickets(options: { limit?: number; offset?: number; search?: string; status?: "open" | "pending" | "resolved" | "closed" } = {}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة تذاكر المنصة");
  const term = options.search?.trim().slice(0, 120);
  const searchCondition = term ? or(like(supportTickets.reference, `%${term}%`), like(supportTickets.subject, `%${term}%`), like(organizations.name, `%${term}%`), like(organizations.slug, `%${term}%`)) : undefined;
  const conditions = searchCondition && options.status ? and(eq(supportTickets.status, options.status), searchCondition) : searchCondition ? searchCondition : options.status ? eq(supportTickets.status, options.status) : undefined;
  return db.select({ id: supportTickets.id, reference: supportTickets.reference, subject: supportTickets.subject, priority: supportTickets.priority, status: supportTickets.status, updatedAt: supportTickets.updatedAt, organizationName: organizations.name, organizationSlug: organizations.slug })
    .from(supportTickets).innerJoin(organizations, eq(supportTickets.organizationId, organizations.id))
    .where(conditions).orderBy(desc(supportTickets.updatedAt)).limit(pageSize(options.limit ?? 25)).offset(pageOffset(options.offset ?? 0));
}

export async function assignPlatformOrganizationSubscription(input: { organizationId: number; planId: number; status: "trialing" | "active" | "past_due" | "suspended" | "cancelled"; endsAt?: Date | null }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لإسناد اشتراك المؤسسة");
  const [organization, plan] = await Promise.all([
    db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, input.organizationId)).limit(1),
    db.select({ id: subscriptionPlans.id, isActive: subscriptionPlans.isActive }).from(subscriptionPlans).where(eq(subscriptionPlans.id, input.planId)).limit(1),
  ]);
  if (!organization[0]) throw new Error("المؤسسة المحددة غير موجودة");
  if (!plan[0] || !plan[0].isActive) throw new Error("خطة الاشتراك المحددة غير متاحة");
  return db.transaction(async tx => {
    await tx.update(organizationSubscriptions).set({ status: "cancelled" }).where(and(eq(organizationSubscriptions.organizationId, input.organizationId), eq(organizationSubscriptions.status, "active")));
    const result = await tx.insert(organizationSubscriptions).values({ organizationId: input.organizationId, planId: input.planId, status: input.status, endsAt: input.endsAt ?? null });
    const organizationStatus = input.status === "active" ? "active" : input.status === "suspended" ? "suspended" : "trial";
    await tx.update(organizations).set({ status: organizationStatus }).where(eq(organizations.id, input.organizationId));
    return { id: Number(result[0]?.insertId), status: input.status, organizationStatus };
  });
}

export async function createPlatformSubscriptionPlan(input: {
  code: string; name: string; description?: string | null; monthlyPrice: string; routerLimit: number; customerLimit: number; staffLimit: number; storageLimitMb: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لإنشاء خطة المنصة");
  const result = await db.insert(subscriptionPlans).values({ ...input, description: input.description ?? null, isActive: 1 });
  return { id: Number(result[0]?.insertId), code: input.code, name: input.name, isActive: true };
}

export type AuditEvent = {
  organizationId: number | null;
  actorUserId: number | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  requestId: string;
  outcome: "success" | "denied" | "failed";
  metadata?: Record<string, unknown>;
};

/** Records security-relevant metadata only; credential-like values are redacted before persistence. */
export async function recordAuditEvent(event: AuditEvent): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Audit] Event was not persisted because the database is unavailable", event.action);
    return;
  }

  try {
    await db.insert(auditLogs).values({
      organizationId: event.organizationId,
      actorUserId: event.actorUserId,
      action: event.action.slice(0, 120),
      resourceType: event.resourceType.slice(0, 80),
      resourceId: event.resourceId?.slice(0, 120) ?? null,
      requestId: event.requestId.slice(0, 100),
      outcome: event.outcome,
      metadata: redactAuditMetadata(event.metadata),
    });
  } catch (error) {
    console.error("[Audit] Failed to persist event", error);
  }
}

export async function listTenantInvoices(organizationId: number, options: { limit?: number; offset?: number; search?: string; status?: "draft" | "issued" | "paid" | "void" | "overdue" } = {}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة الفواتير");
  const terms = options.search?.trim().slice(0, 120);
  const searchCondition = terms ? or(like(invoices.number, `%${terms}%`), like(customers.fullName, `%${terms}%`)) : undefined;
  const conditions = searchCondition && options.status ? and(eq(invoices.organizationId, organizationId), eq(invoices.status, options.status), searchCondition) : searchCondition ? and(eq(invoices.organizationId, organizationId), searchCondition) : options.status ? and(eq(invoices.organizationId, organizationId), eq(invoices.status, options.status)) : eq(invoices.organizationId, organizationId);
  return db.select({ id: invoices.id, number: invoices.number, total: invoices.total, status: invoices.status, issuedAt: invoices.issuedAt, dueAt: invoices.dueAt, createdAt: invoices.createdAt, customerName: customers.fullName })
    .from(invoices).leftJoin(customers, eq(invoices.customerId, customers.id)).where(conditions)
    .orderBy(desc(invoices.createdAt)).limit(pageSize(options.limit ?? 25)).offset(pageOffset(options.offset ?? 0));
}

export async function listTenantPayments(organizationId: number, options: { limit?: number; offset?: number; search?: string; status?: "pending" | "confirmed" | "failed" | "refunded" } = {}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة الدفعات");
  const terms = options.search?.trim().slice(0, 120);
  const searchCondition = terms ? or(like(payments.reference, `%${terms}%`), like(invoices.number, `%${terms}%`)) : undefined;
  const conditions = searchCondition && options.status ? and(eq(payments.organizationId, organizationId), eq(payments.status, options.status), searchCondition) : searchCondition ? and(eq(payments.organizationId, organizationId), searchCondition) : options.status ? and(eq(payments.organizationId, organizationId), eq(payments.status, options.status)) : eq(payments.organizationId, organizationId);
  return db.select({ id: payments.id, invoiceId: payments.invoiceId, invoiceNumber: invoices.number, amount: payments.amount, method: payments.method, status: payments.status, reference: payments.reference, paidAt: payments.paidAt, createdAt: payments.createdAt })
    .from(payments).leftJoin(invoices, eq(payments.invoiceId, invoices.id)).where(conditions).orderBy(desc(payments.createdAt)).limit(pageSize(options.limit ?? 25)).offset(pageOffset(options.offset ?? 0));
}

export async function createTenantInvoice(input: { organizationId: number; customerId?: number | null; total: string; dueAt?: Date | null }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لإنشاء الفاتورة");
  if (input.customerId) {
    const customer = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.id, input.customerId), eq(customers.organizationId, input.organizationId))).limit(1);
    if (!customer[0]) throw new Error("العميل المحدد لا يتبع للمؤسسة");
  }
  const number = `INV-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 5).toUpperCase()}`;
  const result = await db.insert(invoices).values({ organizationId: input.organizationId, customerId: input.customerId ?? null, number, total: input.total, dueAt: input.dueAt ?? null, status: "draft" });
  return { id: Number(result[0]?.insertId), number, status: "draft" as const };
}

export async function issueTenantInvoice(input: { organizationId: number; userId: number; invoiceId: number }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لإصدار الفاتورة");
  const invoice = await db.select({ id: invoices.id, number: invoices.number, total: invoices.total, status: invoices.status, customerId: invoices.customerId }).from(invoices)
    .where(and(eq(invoices.id, input.invoiceId), eq(invoices.organizationId, input.organizationId))).limit(1);
  if (!invoice[0]) throw new Error("الفاتورة المحددة لا تتبع للمؤسسة");
  if (invoice[0].status !== "draft") throw new Error("لا يمكن إصدار فاتورة ليست في حالة مسودة");
  const amount = String(invoice[0].total);
  assertBalancedJournalLines([{ accountCode: "1100", debit: amount, credit: "0" }, { accountCode: "4100", debit: "0", credit: amount }]);
  await db.transaction(async tx => {
    await tx.update(invoices).set({ status: "issued", issuedAt: new Date() }).where(and(eq(invoices.id, input.invoiceId), eq(invoices.organizationId, input.organizationId)));
    const entry = await tx.insert(journalEntries).values({ organizationId: input.organizationId, number: `JE-${invoice[0].number}`, description: `إصدار فاتورة ${invoice[0].number}`, occurredAt: new Date(), createdByUserId: input.userId });
    const entryId = Number(entry[0]?.insertId);
    await tx.insert(journalLines).values([{ journalEntryId: entryId, accountCode: "1100", debit: amount, credit: "0" }, { journalEntryId: entryId, accountCode: "4100", debit: "0", credit: amount }]);
  });
  const pointsSettingsRow = await getTenantPointsSettings(input.organizationId);
  const award = invoicePointsToAward({
    isEnabled: pointsSettingsRow.isEnabled,
    minimumAmount: String(pointsSettingsRow.minimumAmount),
    invoiceTotal: amount,
    customerId: invoice[0].customerId,
  });
  if (award) {
    await postTenantPointLedgerEntry({
      organizationId: input.organizationId,
      userId: input.userId,
      customerId: award.customerId,
      kind: award.kind,
      points: award.points,
      reason: `إصدار فاتورة ${invoice[0].number}`,
    });
  }
  return { id: invoice[0].id, number: invoice[0].number, status: "issued" as const };
}

export async function recordTenantPayment(input: { organizationId: number; userId: number; invoiceId: number; amount: string; method: "cash" | "bank" | "gateway" | "credit"; reference?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لتسجيل الدفعة");
  const invoice = await db.select({ id: invoices.id, number: invoices.number, total: invoices.total, status: invoices.status }).from(invoices)
    .where(and(eq(invoices.id, input.invoiceId), eq(invoices.organizationId, input.organizationId))).limit(1);
  if (!invoice[0]) throw new Error("الفاتورة المحددة لا تتبع للمؤسسة");
  if (invoice[0].status !== "issued" && invoice[0].status !== "overdue") throw new Error("لا يمكن تسجيل دفعة لهذه الفاتورة في حالتها الحالية");
  const [paid] = await db.select({ total: sql<string>`coalesce(sum(${payments.amount}), 0)` }).from(payments).where(and(eq(payments.organizationId, input.organizationId), eq(payments.invoiceId, input.invoiceId), eq(payments.status, "confirmed")));
  const newPaidTotal = addMoney(String(paid?.total ?? "0"), input.amount);
  const invoiceTotal = String(invoice[0].total);
  if (compareMoney(newPaidTotal, invoiceTotal) > 0) throw new Error("قيمة الدفعة تتجاوز الرصيد المتبقي في الفاتورة");
  assertBalancedJournalLines([{ accountCode: input.method === "cash" ? "1000" : "1010", debit: input.amount, credit: "0" }, { accountCode: "1100", debit: "0", credit: input.amount }]);
  const paymentReference = input.reference?.trim() || `PAY-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 5).toUpperCase()}`;
  const payment = await db.transaction(async tx => {
    const paymentResult = await tx.insert(payments).values({ organizationId: input.organizationId, invoiceId: input.invoiceId, amount: input.amount, method: input.method, status: "confirmed", reference: paymentReference, paidAt: new Date() });
    const paymentId = Number(paymentResult[0]?.insertId);
    const entry = await tx.insert(journalEntries).values({ organizationId: input.organizationId, number: `JE-${paymentReference}`, description: `تسجيل دفعة ${paymentReference}`, occurredAt: new Date(), createdByUserId: input.userId });
    const entryId = Number(entry[0]?.insertId);
    await tx.insert(journalLines).values([{ journalEntryId: entryId, accountCode: input.method === "cash" ? "1000" : "1010", debit: input.amount, credit: "0" }, { journalEntryId: entryId, accountCode: "1100", debit: "0", credit: input.amount }]);
    if (compareMoney(newPaidTotal, invoiceTotal) === 0) await tx.update(invoices).set({ status: "paid" }).where(and(eq(invoices.id, input.invoiceId), eq(invoices.organizationId, input.organizationId)));
    return { paymentId };
  });
  return { id: payment.paymentId, reference: paymentReference, invoiceStatus: compareMoney(newPaidTotal, invoiceTotal) === 0 ? "paid" as const : invoice[0].status };
}

export async function recordTenantPaymentRefund(input: { organizationId: number; userId: number; paymentId: number }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لاسترداد الدفعة");
  const payment = await db.select({ id: payments.id, invoiceId: payments.invoiceId, amount: payments.amount, method: payments.method, status: payments.status, reference: payments.reference, invoiceTotal: invoices.total }).from(payments)
    .innerJoin(invoices, eq(payments.invoiceId, invoices.id)).where(and(eq(payments.id, input.paymentId), eq(payments.organizationId, input.organizationId))).limit(1);
  if (!payment[0]) throw new Error("الدفعة المحددة لا تتبع للمؤسسة أو لا ترتبط بفاتورة");
  if (payment[0].status !== "confirmed") throw new Error("لا يمكن استرداد دفعة غير مؤكدة");
  const current = payment[0];
  const invoiceId = current.invoiceId;
  if (!invoiceId) throw new Error("الدفعة المحددة لا ترتبط بفاتورة قابلة للاسترداد");
  const [otherPayments] = await db.select({ total: sql<string>`coalesce(sum(${payments.amount}), 0)` }).from(payments).where(and(eq(payments.organizationId, input.organizationId), eq(payments.invoiceId, invoiceId), eq(payments.status, "confirmed"), ne(payments.id, current.id)));
  const remainingPaid = String(otherPayments?.total ?? "0"); const invoiceTotal = String(current.invoiceTotal); const cashAccount = current.method === "cash" ? "1000" : "1010";
  assertBalancedJournalLines([{ accountCode: "1100", debit: String(current.amount), credit: "0" }, { accountCode: cashAccount, debit: "0", credit: String(current.amount) }]);
  const reference = `RFD-${current.reference ?? current.id}-${crypto.randomUUID().slice(0, 5).toUpperCase()}`;
  await db.transaction(async tx => {
    await tx.update(payments).set({ status: "refunded" }).where(and(eq(payments.id, current.id), eq(payments.organizationId, input.organizationId), eq(payments.status, "confirmed")));
    const entry = await tx.insert(journalEntries).values({ organizationId: input.organizationId, number: `JE-${reference}`, description: `عكس دفعة ${current.reference ?? current.id}`, occurredAt: new Date(), createdByUserId: input.userId });
    const entryId = Number(entry[0]?.insertId);
    await tx.insert(journalLines).values([{ journalEntryId: entryId, accountCode: "1100", debit: String(current.amount), credit: "0" }, { journalEntryId: entryId, accountCode: cashAccount, debit: "0", credit: String(current.amount) }]);
    await tx.update(invoices).set({ status: compareMoney(remainingPaid, invoiceTotal) === 0 ? "paid" : "issued" }).where(and(eq(invoices.id, invoiceId), eq(invoices.organizationId, input.organizationId)));
  });
  return { id: current.id, reference, invoiceStatus: compareMoney(remainingPaid, invoiceTotal) === 0 ? "paid" as const : "issued" as const };
}

// ===========================================================================
// ACCOUNTING MODULE — hierarchical chart of accounts, cash boxes,
// warehouses, stock transfers, and cash vouchers (سند قبض/صرف). Cash
// vouchers post through the EXISTING flat journalEntries/journalLines
// tables (reusing assertBalancedJournalLines from server/financial.ts) by
// writing the chart account's `accountNumber` into journalLines.accountCode
// — this bridges the new hierarchical chart with the legacy flat ledger
// used by issueTenantInvoice/recordTenantPayment above, so
// listTenantJournalEntries/getTenantReportSummary keep working unmodified
// and see a single unified ledger regardless of which feature posted to it.
// ===========================================================================

/** Minor-units balance arithmetic that (unlike financial.ts's assertBalancedJournalLines helpers) tolerates negative running balances, since liability/contra accounts can legitimately go negative. Local to this module — not exported. */
function toMinor(value: string): number { return Math.round(Number(value) * 100); }
function fromMinor(value: number): string { return (value / 100).toFixed(2); }
function applyDebitCredit(balance: string, nature: "debit" | "credit", debit: string, credit: string): string {
  const delta = nature === "debit" ? toMinor(debit) - toMinor(credit) : toMinor(credit) - toMinor(debit);
  return fromMinor(toMinor(balance) + delta);
}

export async function listTenantChartAccounts(organizationId: number, options: { search?: string } = {}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة دليل الحسابات");
  const terms = options.search?.trim().slice(0, 120);
  const searchCondition = terms ? or(like(chartAccounts.name, `%${terms}%`), like(chartAccounts.accountNumber, `%${terms}%`)) : undefined;
  const conditions = searchCondition ? and(eq(chartAccounts.organizationId, organizationId), searchCondition) : eq(chartAccounts.organizationId, organizationId);
  return db.select({ id: chartAccounts.id, parentId: chartAccounts.parentId, accountNumber: chartAccounts.accountNumber, name: chartAccounts.name, grade: chartAccounts.grade, kind: chartAccounts.kind, nature: chartAccounts.nature, isCashBox: chartAccounts.isCashBox, isWarehouse: chartAccounts.isWarehouse, isDeletable: chartAccounts.isDeletable, balance: chartAccounts.balance })
    .from(chartAccounts).where(conditions).orderBy(chartAccounts.accountNumber);
}

export async function createTenantChartAccount(input: { organizationId: number; parentId?: number | null; accountNumber: string; name: string; kind: "asset" | "liability" | "equity" | "revenue" | "expense"; nature: "debit" | "credit" }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لإنشاء الحساب");
  let grade = 1;
  if (input.parentId) {
    const parent = await db.select({ id: chartAccounts.id, grade: chartAccounts.grade }).from(chartAccounts)
      .where(and(eq(chartAccounts.id, input.parentId), eq(chartAccounts.organizationId, input.organizationId))).limit(1);
    if (!parent[0]) throw new Error("الحساب الأب المحدد لا يتبع للمؤسسة");
    grade = parent[0].grade + 1;
  }
  const result = await db.insert(chartAccounts).values({ organizationId: input.organizationId, parentId: input.parentId ?? null, accountNumber: input.accountNumber.trim(), name: input.name.trim(), grade, kind: input.kind, nature: input.nature, balance: "0" });
  return { id: Number(result[0]?.insertId), accountNumber: input.accountNumber.trim(), name: input.name.trim(), grade, balance: "0" };
}

export async function listTenantCashBoxes(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة الصناديق النقدية");
  return db.select({ id: cashBoxes.id, name: cashBoxes.name, isDefault: cashBoxes.isDefault, accountId: cashBoxes.accountId, accountNumber: chartAccounts.accountNumber, balance: chartAccounts.balance })
    .from(cashBoxes).innerJoin(chartAccounts, eq(cashBoxes.accountId, chartAccounts.id)).where(eq(cashBoxes.organizationId, organizationId)).orderBy(desc(cashBoxes.createdAt));
}

export async function createTenantCashBox(input: { organizationId: number; name: string; accountId: number }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لإنشاء الصندوق");
  const account = await db.select({ id: chartAccounts.id }).from(chartAccounts).where(and(eq(chartAccounts.id, input.accountId), eq(chartAccounts.organizationId, input.organizationId))).limit(1);
  if (!account[0]) throw new Error("الحساب المحدد لا يتبع للمؤسسة");
  return db.transaction(async tx => {
    await tx.update(chartAccounts).set({ isCashBox: 1 }).where(eq(chartAccounts.id, input.accountId));
    const result = await tx.insert(cashBoxes).values({ organizationId: input.organizationId, accountId: input.accountId, name: input.name.trim() });
    return { id: Number(result[0]?.insertId), name: input.name.trim() };
  });
}

export async function listTenantWarehouses(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة المخازن");
  return db.select({ id: warehouses.id, name: warehouses.name, location: warehouses.location, accountId: warehouses.accountId }).from(warehouses).where(eq(warehouses.organizationId, organizationId)).orderBy(desc(warehouses.createdAt));
}

export async function createTenantWarehouse(input: { organizationId: number; name: string; location?: string | null; accountId?: number | null }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لإنشاء المخزن");
  if (input.accountId) {
    const account = await db.select({ id: chartAccounts.id }).from(chartAccounts).where(and(eq(chartAccounts.id, input.accountId), eq(chartAccounts.organizationId, input.organizationId))).limit(1);
    if (!account[0]) throw new Error("الحساب المحدد لا يتبع للمؤسسة");
    await db.update(chartAccounts).set({ isWarehouse: 1 }).where(eq(chartAccounts.id, input.accountId));
  }
  const result = await db.insert(warehouses).values({ organizationId: input.organizationId, name: input.name.trim(), location: input.location ?? null, accountId: input.accountId ?? null });
  return { id: Number(result[0]?.insertId), name: input.name.trim() };
}

export async function listTenantStockTransfers(organizationId: number, options: { limit?: number; offset?: number } = {}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة تحويلات المخزون");
  return db.select({ id: stockTransfers.id, reference: stockTransfers.reference, itemDescription: stockTransfers.itemDescription, quantity: stockTransfers.quantity, status: stockTransfers.status, fromWarehouseId: stockTransfers.fromWarehouseId, toWarehouseId: stockTransfers.toWarehouseId, createdAt: stockTransfers.createdAt })
    .from(stockTransfers).where(eq(stockTransfers.organizationId, organizationId)).orderBy(desc(stockTransfers.createdAt)).limit(pageSize(options.limit ?? 25)).offset(pageOffset(options.offset ?? 0));
}

export async function createTenantStockTransfer(input: { organizationId: number; userId: number; fromWarehouseId?: number | null; toWarehouseId?: number | null; itemDescription: string; quantity: number }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لإنشاء تحويل المخزون");
  if (!input.fromWarehouseId && !input.toWarehouseId) throw new Error("يجب تحديد مخزن مصدر أو وجهة على الأقل");
  if (input.fromWarehouseId && input.toWarehouseId && input.fromWarehouseId === input.toWarehouseId) throw new Error("لا يمكن أن يكون مخزن المصدر والوجهة نفس المخزن");
  for (const warehouseId of [input.fromWarehouseId, input.toWarehouseId]) {
    if (!warehouseId) continue;
    const warehouse = await db.select({ id: warehouses.id }).from(warehouses).where(and(eq(warehouses.id, warehouseId), eq(warehouses.organizationId, input.organizationId))).limit(1);
    if (!warehouse[0]) throw new Error("المخزن المحدد لا يتبع للمؤسسة");
  }
  const reference = `STK-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 5).toUpperCase()}`;
  const result = await db.insert(stockTransfers).values({ organizationId: input.organizationId, fromWarehouseId: input.fromWarehouseId ?? null, toWarehouseId: input.toWarehouseId ?? null, reference, itemDescription: input.itemDescription.trim(), quantity: input.quantity, status: "draft", createdByUserId: input.userId });
  return { id: Number(result[0]?.insertId), reference, status: "draft" as const };
}

const stockTransferTransitions = { draft: ["confirmed", "cancelled"], confirmed: [], cancelled: [] } as const;

export async function updateTenantStockTransferStatus(input: { organizationId: number; transferId: number; status: "confirmed" | "cancelled" }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لتحديث تحويل المخزون");
  const current = await db.select({ status: stockTransfers.status }).from(stockTransfers).where(and(eq(stockTransfers.id, input.transferId), eq(stockTransfers.organizationId, input.organizationId))).limit(1);
  if (!current[0]) throw new Error("تحويل المخزون المحدد لا يتبع للمؤسسة");
  if (!(stockTransferTransitions[current[0].status] as readonly string[]).includes(input.status)) throw new Error("انتقال حالة تحويل المخزون غير مسموح");
  await db.update(stockTransfers).set({ status: input.status }).where(and(eq(stockTransfers.id, input.transferId), eq(stockTransfers.organizationId, input.organizationId)));
  return { id: input.transferId, status: input.status };
}

export async function listTenantCashVouchers(organizationId: number, options: { limit?: number; offset?: number; kind?: "receipt" | "payment" } = {}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة سندات القبض والصرف");
  const conditions = options.kind ? and(eq(cashVouchers.organizationId, organizationId), eq(cashVouchers.kind, options.kind)) : eq(cashVouchers.organizationId, organizationId);
  return db.select({ id: cashVouchers.id, reference: cashVouchers.reference, kind: cashVouchers.kind, amount: cashVouchers.amount, description: cashVouchers.description, cashBoxId: cashVouchers.cashBoxId, cashBoxName: cashBoxes.name, createdAt: cashVouchers.createdAt })
    .from(cashVouchers).innerJoin(cashBoxes, eq(cashVouchers.cashBoxId, cashBoxes.id)).where(conditions).orderBy(desc(cashVouchers.createdAt)).limit(pageSize(options.limit ?? 25)).offset(pageOffset(options.offset ?? 0));
}

export async function createTenantCashVoucher(input: { organizationId: number; userId: number; cashBoxId: number; counterAccountId: number; customerId?: number | null; kind: "receipt" | "payment"; amount: string; description?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لإنشاء السند");
  const cashBoxRow = await db.select({ id: cashBoxes.id, accountId: cashBoxes.accountId, accountNumber: chartAccounts.accountNumber, nature: chartAccounts.nature, balance: chartAccounts.balance })
    .from(cashBoxes).innerJoin(chartAccounts, eq(cashBoxes.accountId, chartAccounts.id)).where(and(eq(cashBoxes.id, input.cashBoxId), eq(cashBoxes.organizationId, input.organizationId))).limit(1);
  if (!cashBoxRow[0]) throw new Error("الصندوق المحدد لا يتبع للمؤسسة");
  const counterRow = await db.select({ id: chartAccounts.id, accountNumber: chartAccounts.accountNumber, nature: chartAccounts.nature, balance: chartAccounts.balance })
    .from(chartAccounts).where(and(eq(chartAccounts.id, input.counterAccountId), eq(chartAccounts.organizationId, input.organizationId))).limit(1);
  if (!counterRow[0]) throw new Error("حساب الطرف الآخر لا يتبع للمؤسسة");
  if (input.customerId) {
    const customer = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.id, input.customerId), eq(customers.organizationId, input.organizationId))).limit(1);
    if (!customer[0]) throw new Error("العميل المحدد لا يتبع للمؤسسة");
  }
  const cashBox = cashBoxRow[0]; const counter = counterRow[0];
  // receipt (سند قبض): cash box is debited (cash increases), counter account is credited.
  // payment (سند صرف): counter account is debited, cash box is credited (cash decreases).
  const cashDebit = input.kind === "receipt" ? input.amount : "0";
  const cashCredit = input.kind === "receipt" ? "0" : input.amount;
  const counterDebit = input.kind === "receipt" ? "0" : input.amount;
  const counterCredit = input.kind === "receipt" ? input.amount : "0";
  assertBalancedJournalLines([{ accountCode: cashBox.accountNumber, debit: cashDebit, credit: cashCredit }, { accountCode: counter.accountNumber, debit: counterDebit, credit: counterCredit }]);
  const reference = `CV-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 5).toUpperCase()}`;
  const result = await db.transaction(async tx => {
    const entry = await tx.insert(journalEntries).values({ organizationId: input.organizationId, number: `JE-${reference}`, description: input.description?.trim() || `سند ${input.kind === "receipt" ? "قبض" : "صرف"} ${reference}`, occurredAt: new Date(), createdByUserId: input.userId });
    const entryId = Number(entry[0]?.insertId);
    await tx.insert(journalLines).values([
      { journalEntryId: entryId, accountCode: cashBox.accountNumber, debit: cashDebit, credit: cashCredit },
      { journalEntryId: entryId, accountCode: counter.accountNumber, debit: counterDebit, credit: counterCredit },
    ]);
    await tx.update(chartAccounts).set({ balance: applyDebitCredit(String(cashBox.balance), cashBox.nature, cashDebit, cashCredit) }).where(eq(chartAccounts.id, cashBox.id));
    await tx.update(chartAccounts).set({ balance: applyDebitCredit(String(counter.balance), counter.nature, counterDebit, counterCredit) }).where(eq(chartAccounts.id, counter.id));
    const voucherResult = await tx.insert(cashVouchers).values({ organizationId: input.organizationId, cashBoxId: input.cashBoxId, counterAccountId: input.counterAccountId, customerId: input.customerId ?? null, kind: input.kind, reference, amount: input.amount, description: input.description ?? null, journalEntryId: entryId, createdByUserId: input.userId });
    return { id: Number(voucherResult[0]?.insertId), entryId };
  });
  return { id: result.id, reference, journalEntryId: result.entryId };
}

// ===========================================================================
// VOUCHER CATEGORIES / GROUPS — multi-tier pricing catalog (retail/
// wholesale/wholesale-of-wholesale) and MikroTik-profile-linked groups,
// matching the competitor's catagory + groups pages. Distinct from the
// existing servicePlans/vouchers/voucherBatches (which model the actual
// issued/sold voucher lifecycle) — categories/groups are the *catalog*
// layer operators configure before issuing a batch under a given group.
// ===========================================================================

export async function listTenantVoucherCategories(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة فئات البطاقات");
  const categories = await db.select({ id: voucherCategories.id, name: voucherCategories.name, priceType: voucherCategories.priceType, amount: voucherCategories.amount, prefix: voucherCategories.prefix, defaultAmount: voucherCategories.defaultAmount, maxAmount: voucherCategories.maxAmount, minAmount: voucherCategories.minAmount })
    .from(voucherCategories).where(eq(voucherCategories.organizationId, organizationId)).orderBy(desc(voucherCategories.createdAt));
  if (!categories.length) return [];
  const prices = await db.select({ categoryId: voucherCategoryPrices.categoryId, tier: voucherCategoryPrices.tier, price: voucherCategoryPrices.price })
    .from(voucherCategoryPrices).where(inArray(voucherCategoryPrices.categoryId, categories.map(category => category.id)));
  return categories.map(category => ({ ...category, prices: prices.filter(price => price.categoryId === category.id).map(({ tier, price }) => ({ tier, price })) }));
}

export async function createTenantVoucherCategory(input: { organizationId: number; name: string; priceType: "fixed" | "customer"; amount: string; prefix?: string | null; defaultAmount?: string | null; maxAmount?: string | null; minAmount?: string | null; prices?: { tier: "retail" | "wholesale" | "wholesale_of_wholesale"; price: string }[] }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لإنشاء فئة البطاقات");
  return db.transaction(async tx => {
    const result = await tx.insert(voucherCategories).values({ organizationId: input.organizationId, name: input.name.trim(), priceType: input.priceType, amount: input.amount, prefix: input.prefix ?? null, defaultAmount: input.defaultAmount ?? null, maxAmount: input.maxAmount ?? null, minAmount: input.minAmount ?? null });
    const categoryId = Number(result[0]?.insertId);
    if (input.prices?.length) await tx.insert(voucherCategoryPrices).values(input.prices.map(price => ({ categoryId, tier: price.tier, price: price.price })));
    return { id: categoryId, name: input.name.trim() };
  });
}

export async function listTenantVoucherGroups(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة مجموعات البطاقات");
  return db.select({ id: voucherGroups.id, name: voucherGroups.name, categoryId: voucherGroups.categoryId, categoryName: voucherCategories.name, limitUsers: voucherGroups.limitUsers, voucherCodeLength: voucherGroups.voucherCodeLength, timeBalanceMinutes: voucherGroups.timeBalanceMinutes, downloadBalanceMb: voucherGroups.downloadBalanceMb, cardValidityDays: voucherGroups.cardValidityDays, speedProfileId: voucherGroups.speedProfileId, mikrotikProfile: voucherGroups.mikrotikProfile, linkWithFirstMac: voucherGroups.linkWithFirstMac })
    .from(voucherGroups).leftJoin(voucherCategories, eq(voucherGroups.categoryId, voucherCategories.id)).where(eq(voucherGroups.organizationId, organizationId)).orderBy(desc(voucherGroups.createdAt));
}

export async function createTenantVoucherGroup(input: { organizationId: number; name: string; categoryId?: number | null; limitUsers?: number; voucherCodeLength?: number; timeBalanceMinutes?: number | null; downloadBalanceMb?: number | null; cardValidityDays?: number | null; speedProfileId?: number | null; mikrotikProfile?: string | null; linkWithFirstMac?: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لإنشاء مجموعة البطاقات");
  if (input.categoryId) {
    const category = await db.select({ id: voucherCategories.id }).from(voucherCategories).where(and(eq(voucherCategories.id, input.categoryId), eq(voucherCategories.organizationId, input.organizationId))).limit(1);
    if (!category[0]) throw new Error("الفئة المحددة لا تتبع للمؤسسة");
  }
  if (input.speedProfileId) {
    const profile = await db.select({ id: speedProfiles.id }).from(speedProfiles).where(and(eq(speedProfiles.id, input.speedProfileId), eq(speedProfiles.organizationId, input.organizationId))).limit(1);
    if (!profile[0]) throw new Error("ملف السرعة المحدد لا يتبع للمؤسسة");
  }
  const result = await db.insert(voucherGroups).values({ organizationId: input.organizationId, categoryId: input.categoryId ?? null, name: input.name.trim(), limitUsers: input.limitUsers ?? 1, voucherCodeLength: input.voucherCodeLength ?? 10, timeBalanceMinutes: input.timeBalanceMinutes ?? null, downloadBalanceMb: input.downloadBalanceMb ?? null, cardValidityDays: input.cardValidityDays ?? null, speedProfileId: input.speedProfileId ?? null, mikrotikProfile: input.mikrotikProfile ?? null, linkWithFirstMac: input.linkWithFirstMac ? 1 : 0 });
  return { id: Number(result[0]?.insertId), name: input.name.trim() };
}

// ===========================================================================
// CARD DESIGN STUDIO + PRINT QUEUE — pixel-level layout definitions and a
// print-job queue. Actual PDF rendering happens in the background worker
// (see server/worker/backgroundJobWorker.ts's job dispatch table, extended
// below) which reads voucherBatches + cardDesigns.fields and writes a PDF
// into the existing `files` table via storagePut, then marks the job ready.
// ===========================================================================

export async function listTenantCardDesigns(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة تصاميم البطاقات");
  const rows = await db.select({ id: cardDesigns.id, name: cardDesigns.name, isDefault: cardDesigns.isDefault, cardWidthMm: cardDesigns.cardWidthMm, cardHeightMm: cardDesigns.cardHeightMm, cardBorderColor: cardDesigns.cardBorderColor, backgroundImageKey: cardDesigns.backgroundImageKey, watermarkOpacity: cardDesigns.watermarkOpacity, watermarkPosition: cardDesigns.watermarkPosition, printSerialAsBarcode: cardDesigns.printSerialAsBarcode, printCardQrCode: cardDesigns.printCardQrCode, fields: cardDesigns.fields, updatedAt: cardDesigns.updatedAt })
    .from(cardDesigns).where(eq(cardDesigns.organizationId, organizationId)).orderBy(desc(cardDesigns.updatedAt));
  return rows.map(row => ({ ...row, fields: JSON.parse(row.fields) as unknown }));
}

export async function saveTenantCardDesign(input: { organizationId: number; userId: number; designId?: number | null; name: string; isDefault?: boolean; cardWidthMm?: string; cardHeightMm?: string; cardBorderColor?: string; backgroundImageKey?: string | null; watermarkOpacity?: number; watermarkPosition?: "center" | "top" | "bottom"; printSerialAsBarcode?: boolean; printCardQrCode?: boolean; fields: unknown }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لحفظ تصميم البطاقة");
  const fieldsJson = JSON.stringify(input.fields ?? {});
  return db.transaction(async tx => {
    if (input.isDefault) await tx.update(cardDesigns).set({ isDefault: 0 }).where(eq(cardDesigns.organizationId, input.organizationId));
    if (input.designId) {
      const existing = await tx.select({ id: cardDesigns.id }).from(cardDesigns).where(and(eq(cardDesigns.id, input.designId), eq(cardDesigns.organizationId, input.organizationId))).limit(1);
      if (!existing[0]) throw new Error("التصميم المحدد لا يتبع للمؤسسة");
      await tx.update(cardDesigns).set({ name: input.name.trim(), isDefault: input.isDefault ? 1 : 0, cardWidthMm: input.cardWidthMm ?? "90", cardHeightMm: input.cardHeightMm ?? "50", cardBorderColor: input.cardBorderColor ?? "#6d28d9", backgroundImageKey: input.backgroundImageKey ?? null, watermarkOpacity: input.watermarkOpacity ?? 0, watermarkPosition: input.watermarkPosition ?? "center", printSerialAsBarcode: input.printSerialAsBarcode === false ? 0 : 1, printCardQrCode: input.printCardQrCode === false ? 0 : 1, fields: fieldsJson }).where(eq(cardDesigns.id, input.designId));
      return { id: input.designId, name: input.name.trim() };
    }
    const result = await tx.insert(cardDesigns).values({ organizationId: input.organizationId, name: input.name.trim(), isDefault: input.isDefault ? 1 : 0, cardWidthMm: input.cardWidthMm ?? "90", cardHeightMm: input.cardHeightMm ?? "50", cardBorderColor: input.cardBorderColor ?? "#6d28d9", backgroundImageKey: input.backgroundImageKey ?? null, watermarkOpacity: input.watermarkOpacity ?? 0, watermarkPosition: input.watermarkPosition ?? "center", printSerialAsBarcode: input.printSerialAsBarcode === false ? 0 : 1, printCardQrCode: input.printCardQrCode === false ? 0 : 1, fields: fieldsJson, createdByUserId: input.userId });
    return { id: Number(result[0]?.insertId), name: input.name.trim() };
  });
}

export async function listTenantPrintJobs(organizationId: number, options: { limit?: number; offset?: number } = {}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة قائمة الطباعة");
  return db.select({ id: printJobs.id, batchId: printJobs.batchId, batchReference: voucherBatches.reference, designId: printJobs.designId, designName: cardDesigns.name, status: printJobs.status, fileId: printJobs.fileId, errorMessage: printJobs.errorMessage, createdAt: printJobs.createdAt })
    .from(printJobs).innerJoin(voucherBatches, eq(printJobs.batchId, voucherBatches.id)).innerJoin(cardDesigns, eq(printJobs.designId, cardDesigns.id))
    .where(eq(printJobs.organizationId, organizationId)).orderBy(desc(printJobs.createdAt)).limit(pageSize(options.limit ?? 25)).offset(pageOffset(options.offset ?? 0));
}

export async function queueTenantPrintJob(input: { organizationId: number; userId: number; batchId: number; designId: number }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لإضافة مهمة الطباعة");
  const [batch, design] = await Promise.all([
    db.select({ id: voucherBatches.id }).from(voucherBatches).where(and(eq(voucherBatches.id, input.batchId), eq(voucherBatches.organizationId, input.organizationId))).limit(1),
    db.select({ id: cardDesigns.id }).from(cardDesigns).where(and(eq(cardDesigns.id, input.designId), eq(cardDesigns.organizationId, input.organizationId))).limit(1),
  ]);
  if (!batch[0]) throw new Error("دفعة البطاقات المحددة لا تتبع للمؤسسة");
  if (!design[0]) throw new Error("تصميم البطاقة المحدد لا يتبع للمؤسسة");
  const result = await db.insert(printJobs).values({ organizationId: input.organizationId, batchId: input.batchId, designId: input.designId, status: "queued", createdByUserId: input.userId });
  return { id: Number(result[0]?.insertId), status: "queued" as const };
}

// ===========================================================================
// FINE-GRAINED CUSTOM ROLES — additive overlay on the base 6-role matrix
// (see server/access.ts + hasEffectiveTenantPermission above). A member's
// base role is unchanged; assigning a custom role only ADDS permissions.
// ===========================================================================

export async function listTenantCustomRoles(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة الأدوار المخصصة");
  const roles = await db.select({ id: customRoles.id, name: customRoles.name, description: customRoles.description, isSystem: customRoles.isSystem, createdAt: customRoles.createdAt })
    .from(customRoles).where(eq(customRoles.organizationId, organizationId)).orderBy(desc(customRoles.createdAt));
  if (!roles.length) return [];
  const permissions = await db.select({ roleId: rolePermissions.roleId, permission: rolePermissions.permission }).from(rolePermissions).where(inArray(rolePermissions.roleId, roles.map(role => role.id)));
  return roles.map(role => ({ ...role, permissions: permissions.filter(permission => permission.roleId === role.id).map(permission => permission.permission) }));
}

export async function createTenantCustomRole(input: { organizationId: number; userId: number; name: string; description?: string | null; permissions: string[] }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لإنشاء الدور المخصص");
  const validPermissions = input.permissions.filter((permission): permission is TenantPermission => (tenantPermissions as readonly string[]).includes(permission));
  return db.transaction(async tx => {
    const result = await tx.insert(customRoles).values({ organizationId: input.organizationId, name: input.name.trim(), description: input.description ?? null, createdByUserId: input.userId });
    const roleId = Number(result[0]?.insertId);
    if (validPermissions.length) await tx.insert(rolePermissions).values(validPermissions.map(permission => ({ roleId, permission })));
    return { id: roleId, name: input.name.trim(), permissions: validPermissions };
  });
}

export async function updateTenantCustomRolePermissions(input: { organizationId: number; roleId: number; permissions: string[] }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لتحديث صلاحيات الدور");
  const role = await db.select({ id: customRoles.id }).from(customRoles).where(and(eq(customRoles.id, input.roleId), eq(customRoles.organizationId, input.organizationId))).limit(1);
  if (!role[0]) throw new Error("الدور المحدد لا يتبع للمؤسسة");
  const validPermissions = input.permissions.filter((permission): permission is TenantPermission => (tenantPermissions as readonly string[]).includes(permission));
  return db.transaction(async tx => {
    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, input.roleId));
    if (validPermissions.length) await tx.insert(rolePermissions).values(validPermissions.map(permission => ({ roleId: input.roleId, permission })));
    return { id: input.roleId, permissions: validPermissions };
  });
}

export async function deleteTenantCustomRole(input: { organizationId: number; roleId: number }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لحذف الدور");
  const role = await db.select({ id: customRoles.id, isSystem: customRoles.isSystem }).from(customRoles).where(and(eq(customRoles.id, input.roleId), eq(customRoles.organizationId, input.organizationId))).limit(1);
  if (!role[0]) throw new Error("الدور المحدد لا يتبع للمؤسسة");
  if (role[0].isSystem) throw new Error("لا يمكن حذف دور نظامي");
  await db.transaction(async tx => {
    await tx.update(organizationMembers).set({ customRoleId: null }).where(and(eq(organizationMembers.organizationId, input.organizationId), eq(organizationMembers.customRoleId, input.roleId)));
    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, input.roleId));
    await tx.delete(customRoles).where(eq(customRoles.id, input.roleId));
  });
  return { id: input.roleId, deleted: true as const };
}

export async function listTenantMembers(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة أعضاء المؤسسة");
  return db.select({ id: organizationMembers.id, userId: organizationMembers.userId, role: organizationMembers.role, status: organizationMembers.status, customRoleId: organizationMembers.customRoleId, customRoleName: customRoles.name, userName: users.name, userEmail: users.email })
    .from(organizationMembers).innerJoin(users, eq(organizationMembers.userId, users.id)).leftJoin(customRoles, eq(organizationMembers.customRoleId, customRoles.id))
    .where(eq(organizationMembers.organizationId, organizationId)).orderBy(desc(organizationMembers.createdAt));
}

export async function assignTenantMemberCustomRole(input: { organizationId: number; memberId: number; customRoleId: number | null }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لتحديث دور العضو");
  const member = await db.select({ id: organizationMembers.id }).from(organizationMembers).where(and(eq(organizationMembers.id, input.memberId), eq(organizationMembers.organizationId, input.organizationId))).limit(1);
  if (!member[0]) throw new Error("العضو المحدد لا يتبع للمؤسسة");
  if (input.customRoleId) {
    const role = await db.select({ id: customRoles.id }).from(customRoles).where(and(eq(customRoles.id, input.customRoleId), eq(customRoles.organizationId, input.organizationId))).limit(1);
    if (!role[0]) throw new Error("الدور المحدد لا يتبع للمؤسسة");
  }
  await db.update(organizationMembers).set({ customRoleId: input.customRoleId }).where(and(eq(organizationMembers.id, input.memberId), eq(organizationMembers.organizationId, input.organizationId)));
  return { id: input.memberId, customRoleId: input.customRoleId };
}

// ===========================================================================
// CUSTOM REPORT BUILDER — user-defined column/filter specs over a fixed set
// of datasets, with optional recurring schedules. Exports are generated as
// CSV and stored via the existing files table (category "report"),
// reusing storagePut from server/storage.ts exactly like uploadTenantFile.
// ===========================================================================

export async function listTenantReportDefinitions(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة تعريفات التقارير");
  const rows = await db.select({ id: reportDefinitions.id, name: reportDefinitions.name, dataset: reportDefinitions.dataset, columns: reportDefinitions.columns, filters: reportDefinitions.filters, updatedAt: reportDefinitions.updatedAt })
    .from(reportDefinitions).where(eq(reportDefinitions.organizationId, organizationId)).orderBy(desc(reportDefinitions.updatedAt));
  return rows.map(row => ({ ...row, columns: JSON.parse(row.columns) as string[], filters: row.filters ? JSON.parse(row.filters) as Record<string, unknown> : null }));
}

export async function createTenantReportDefinition(input: { organizationId: number; userId: number; name: string; dataset: "customers" | "invoices" | "payments" | "vouchers" | "sessions" | "journal_entries" | "support_tickets"; columns: string[]; filters?: Record<string, unknown> | null }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لإنشاء تعريف التقرير");
  if (!input.columns.length) throw new Error("يجب اختيار عمود واحد على الأقل");
  const result = await db.insert(reportDefinitions).values({ organizationId: input.organizationId, name: input.name.trim(), dataset: input.dataset, columns: JSON.stringify(input.columns), filters: input.filters ? JSON.stringify(input.filters) : null, createdByUserId: input.userId });
  return { id: Number(result[0]?.insertId), name: input.name.trim() };
}

export async function listTenantReportSchedules(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة جدولة التقارير");
  return db.select({ id: reportSchedules.id, reportDefinitionId: reportSchedules.reportDefinitionId, reportName: reportDefinitions.name, frequency: reportSchedules.frequency, isEnabled: reportSchedules.isEnabled, lastRunAt: reportSchedules.lastRunAt, nextRunAt: reportSchedules.nextRunAt })
    .from(reportSchedules).innerJoin(reportDefinitions, eq(reportSchedules.reportDefinitionId, reportDefinitions.id)).where(eq(reportSchedules.organizationId, organizationId)).orderBy(desc(reportSchedules.createdAt));
}

function nextRunFor(frequency: "daily" | "weekly" | "monthly", from: Date): Date {
  const next = new Date(from);
  if (frequency === "daily") next.setUTCDate(next.getUTCDate() + 1);
  else if (frequency === "weekly") next.setUTCDate(next.getUTCDate() + 7);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

export async function createTenantReportSchedule(input: { organizationId: number; reportDefinitionId: number; frequency: "daily" | "weekly" | "monthly" }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لإنشاء الجدولة");
  const definition = await db.select({ id: reportDefinitions.id }).from(reportDefinitions).where(and(eq(reportDefinitions.id, input.reportDefinitionId), eq(reportDefinitions.organizationId, input.organizationId))).limit(1);
  if (!definition[0]) throw new Error("تعريف التقرير المحدد لا يتبع للمؤسسة");
  const now = new Date();
  const result = await db.insert(reportSchedules).values({ organizationId: input.organizationId, reportDefinitionId: input.reportDefinitionId, frequency: input.frequency, isEnabled: 1, nextRunAt: nextRunFor(input.frequency, now) });
  return { id: Number(result[0]?.insertId), frequency: input.frequency };
}

/**
 * Runs any report schedules whose nextRunAt has passed. Since this project
 * has no cron trigger (single VPS, no scheduler dependency — see
 * architecture notes on backgroundJobWorker.ts), schedules are caught up
 * lazily: this is called opportunistically from the report-builder router
 * on every `schedules.list` read, exactly like the "catch up on request"
 * pattern used for periodic work in Cloudflare-hosted variants of Netora.
 */
export async function runDueTenantReportSchedules(organizationId: number) {
  const db = await getDb();
  if (!db) return;
  const now = new Date();
  const rows = await db.select({ id: reportSchedules.id, reportDefinitionId: reportSchedules.reportDefinitionId, frequency: reportSchedules.frequency, nextRunAt: reportSchedules.nextRunAt }).from(reportSchedules)
    .where(and(eq(reportSchedules.organizationId, organizationId), eq(reportSchedules.isEnabled, 1)));
  for (const row of rows) {
    if (!row.nextRunAt || row.nextRunAt > now) continue;
    await db.insert(reportExports).values({ organizationId, reportDefinitionId: row.reportDefinitionId, status: "queued" });
    await db.update(reportSchedules).set({ lastRunAt: now, nextRunAt: nextRunFor(row.frequency, now) }).where(eq(reportSchedules.id, row.id));
  }
}

const reportDatasetTables = { customers, invoices, payments, vouchers, sessions: networkSessions, journal_entries: journalEntries, support_tickets: supportTickets } as const;

export async function listTenantReportExports(organizationId: number, options: { limit?: number; offset?: number } = {}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة تصديرات التقارير");
  return db.select({ id: reportExports.id, reportDefinitionId: reportExports.reportDefinitionId, reportName: reportDefinitions.name, status: reportExports.status, rowCount: reportExports.rowCount, fileId: reportExports.fileId, createdAt: reportExports.createdAt })
    .from(reportExports).innerJoin(reportDefinitions, eq(reportExports.reportDefinitionId, reportDefinitions.id)).where(eq(reportExports.organizationId, organizationId)).orderBy(desc(reportExports.createdAt)).limit(pageSize(options.limit ?? 25)).offset(pageOffset(options.offset ?? 0));
}

/** Generates a CSV/Excel/PDF export synchronously (datasets are per-tenant and expected to be small enough for an in-request generation; matches the existing uploadTenantFile size cap). */
export async function generateTenantReportExport(input: { organizationId: number; userId: number; reportDefinitionId: number; format?: "csv" | "excel" | "pdf" }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لتوليد التقرير");
  const definition = await db.select({ id: reportDefinitions.id, name: reportDefinitions.name, dataset: reportDefinitions.dataset, columns: reportDefinitions.columns }).from(reportDefinitions)
    .where(and(eq(reportDefinitions.id, input.reportDefinitionId), eq(reportDefinitions.organizationId, input.organizationId))).limit(1);
  if (!definition[0]) throw new Error("تعريف التقرير المحدد لا يتبع للمؤسسة");
  const table = reportDatasetTables[definition[0].dataset];
  const orgColumn = (table as { organizationId?: unknown }).organizationId;
  const rows: Record<string, unknown>[] = orgColumn ? await (db.select().from(table as never).where(eq(orgColumn as never, input.organizationId)).limit(5000) as unknown as Promise<Record<string, unknown>[]>) : [];
  const columns = JSON.parse(definition[0].columns) as string[];
  const format = input.format ?? "csv";
  const { reportExportPayload } = await import("./reportExport");
  const payload = reportExportPayload(format, definition[0].name, columns, rows);
  const safeName = definition[0].name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const { storagePut } = await import("./storage");
  const { key } = await storagePut(`organizations/${input.organizationId}/report/${Date.now()}_${safeName}.${payload.extension}`, payload.body, payload.mimeType);
  return db.transaction(async tx => {
    const fileResult = await tx.insert(files).values({ organizationId: input.organizationId, storageKey: key, originalName: payload.originalName, mimeType: payload.mimeType, sizeBytes: payload.body.length, category: "report", createdByUserId: input.userId });
    const fileId = Number(fileResult[0]?.insertId);
    const exportResult = await tx.insert(reportExports).values({ organizationId: input.organizationId, reportDefinitionId: input.reportDefinitionId, fileId, status: "ready", rowCount: rows.length, createdByUserId: input.userId });
    return { id: Number(exportResult[0]?.insertId), fileId, rowCount: rows.length, status: "ready" as const, format };
  });
}

// ===========================================================================
// BACKUP SYSTEM — logical export of the organization's own tenant-scoped
// tables as one JSON snapshot, stored via the existing files table
// (category "backup"). Restoring re-imports rows guarded by
// organizationId, so it can never touch another tenant's data.
// ===========================================================================

const backupTables = { customers, invoices, payments, journalEntries, servicePlans, vouchers, voucherBatches, supportTickets } as const;

export async function listTenantBackupJobs(organizationId: number, options: { limit?: number; offset?: number } = {}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة النسخ الاحتياطية");
  return db.select({ id: backupJobs.id, status: backupJobs.status, fileId: backupJobs.fileId, sizeBytes: backupJobs.sizeBytes, errorMessage: backupJobs.errorMessage, createdAt: backupJobs.createdAt, completedAt: backupJobs.completedAt })
    .from(backupJobs).where(eq(backupJobs.organizationId, organizationId)).orderBy(desc(backupJobs.createdAt)).limit(pageSize(options.limit ?? 25)).offset(pageOffset(options.offset ?? 0));
}

/**
 * Runs synchronously (tenant-scoped datasets are expected to be small);
 * mirrors the create->store->mark-ready flow used by generateTenantReportExport.
 * When method="mysqldump", a real `mysqldump` binary dump is attempted first
 * (full-DB fidelity); if DATABASE_URL is missing or mysqldump is unavailable,
 * it falls back to the logical per-tenant JSON snapshot so a backup is still
 * produced — never silently skipped.
 */
export async function createTenantBackupJob(input: { organizationId: number; userId: number; method?: "json" | "mysqldump" }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لإنشاء النسخة الاحتياطية");
  const jobResult = await db.insert(backupJobs).values({ organizationId: input.organizationId, status: "running", createdByUserId: input.userId });
  const jobId = Number(jobResult[0]?.insertId);
  const storageName = `backup_${Date.now()}`;
  try {
    let payload: Buffer;
    let mimeType: string;
    if (input.method === "mysqldump") {
      try {
        const { runMysqldump } = await import("./mysqldump");
        payload = await runMysqldump();
        mimeType = "application/sql";
      } catch (dumpError) {
        console.warn(`[Backup] mysqldump unavailable (${dumpError instanceof Error ? dumpError.message : "خطأ"}) — falling back to JSON snapshot for org ${input.organizationId}`);
        const snapshot: Record<string, unknown[]> = {};
        for (const [key, table] of Object.entries(backupTables)) {
          snapshot[key] = await db.select().from(table as never).where(eq((table as { organizationId: unknown }).organizationId as never, input.organizationId)).limit(20000) as unknown[];
        }
        payload = Buffer.from(JSON.stringify({ generatedAt: new Date().toISOString(), organizationId: input.organizationId, tables: snapshot }), "utf8");
        mimeType = "application/json";
      }
    } else {
      const snapshot: Record<string, unknown[]> = {};
      for (const [key, table] of Object.entries(backupTables)) {
        snapshot[key] = await db.select().from(table as never).where(eq((table as { organizationId: unknown }).organizationId as never, input.organizationId)).limit(20000) as unknown[];
      }
      payload = Buffer.from(JSON.stringify({ generatedAt: new Date().toISOString(), organizationId: input.organizationId, tables: snapshot }), "utf8");
      mimeType = "application/json";
    }
    const extension = mimeType === "application/sql" ? "sql" : "json";
    const { storagePut } = await import("./storage");
    const { key } = await storagePut(`organizations/${input.organizationId}/backup/${storageName}.${extension}`, payload, mimeType);
    const bytes = payload.length;
    const fileResult = await db.insert(files).values({ organizationId: input.organizationId, storageKey: key, originalName: `${storageName}.${extension}`, mimeType, sizeBytes: bytes, category: "backup", createdByUserId: input.userId });
    const fileId = Number(fileResult[0]?.insertId);
    await db.update(backupJobs).set({ status: "ready", fileId, sizeBytes: bytes, completedAt: new Date() }).where(eq(backupJobs.id, jobId));
    return { id: jobId, status: "ready" as const, fileId, sizeBytes: bytes, method: input.method ?? "json" };
  } catch (error) {
    await db.update(backupJobs).set({ status: "failed", errorMessage: error instanceof Error ? error.message : "خطأ غير معروف" }).where(eq(backupJobs.id, jobId));
    throw error;
  }
}

// ===========================================================================
// SERVER MONITOR — per-organization monitoring config + resource samples.
// Real CPU/memory/disk/battery readings and reboot/shutdown execution are
// out of scope for the Netora API process itself (a multi-tenant SaaS
// process cannot safely reboot the VPS it's hosted on); this module stores
// samples reported by an optional external agent/script (matching the
// competitor's MonitorScriptVariables model) and configuration for
// rebootable/shutdownable capability flags + Telegram battery alerts,
// which a separately-deployed agent script reads and acts on.
// ===========================================================================

export async function getTenantMonitorSettings(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة إعدادات المراقبة");
  const result = await db.select().from(monitorSettings).where(eq(monitorSettings.organizationId, organizationId)).limit(1);
  return result[0] ?? { organizationId, rebootable: 1, shutdownable: 1, batteryNotification: 0, batteryNotificationType: "telegram" as const, batteryWarningPercentage: 50, batteryCriticalPercentage: 10, telegramChatId: null };
}

export async function saveTenantMonitorSettings(input: { organizationId: number; rebootable: boolean; shutdownable: boolean; batteryNotification: boolean; batteryNotificationType: "telegram" | "sms" | "email"; batteryWarningPercentage: number; batteryCriticalPercentage: number; telegramChatId?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لحفظ إعدادات المراقبة");
  const values = { organizationId: input.organizationId, rebootable: input.rebootable ? 1 : 0, shutdownable: input.shutdownable ? 1 : 0, batteryNotification: input.batteryNotification ? 1 : 0, batteryNotificationType: input.batteryNotificationType, batteryWarningPercentage: input.batteryWarningPercentage, batteryCriticalPercentage: input.batteryCriticalPercentage, telegramChatId: input.telegramChatId ?? null };
  await db.insert(monitorSettings).values(values).onDuplicateKeyUpdate({ set: values });
  return { organizationId: input.organizationId };
}

export async function listTenantMonitorSamples(organizationId: number, options: { limit?: number } = {}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة قراءات المراقبة");
  return db.select({ id: monitorSamples.id, cpuPercent: monitorSamples.cpuPercent, memoryPercent: monitorSamples.memoryPercent, diskPercent: monitorSamples.diskPercent, batteryPercent: monitorSamples.batteryPercent, serviceStatus: monitorSamples.serviceStatus, createdAt: monitorSamples.createdAt })
    .from(monitorSamples).where(eq(monitorSamples.organizationId, organizationId)).orderBy(desc(monitorSamples.createdAt)).limit(pageSize(options.limit ?? 50));
}

/** Called by the (optional) external monitoring agent to report a sample. If battery drops at/below the critical threshold and notifications are enabled, a Telegram alert is dispatched (best-effort; failures are swallowed so a missing bot token never blocks sample ingestion). */
export async function recordTenantMonitorSample(input: { organizationId: number; cpuPercent?: number | null; memoryPercent?: number | null; diskPercent?: number | null; batteryPercent?: number | null; serviceStatus?: "healthy" | "degraded" | "down" }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لتسجيل قراءة المراقبة");
  const sampleResult = await db.insert(monitorSamples).values({ organizationId: input.organizationId, cpuPercent: input.cpuPercent ?? null, memoryPercent: input.memoryPercent ?? null, diskPercent: input.diskPercent ?? null, batteryPercent: input.batteryPercent ?? null, serviceStatus: input.serviceStatus ?? "healthy" });
  const sampleId = Number(sampleResult[0]?.insertId);
  await db.insert(backgroundJobs).values({ organizationId: input.organizationId, routerId: null, type: "monitor_alert_dispatch", idempotencyKey: `sample_${sampleId}`, status: "queued", payload: JSON.stringify({ operation: "monitor_alert_dispatch", sampleId }) });
  return { recorded: true as const };
}

/** Queues a monitor action (reboot/shutdown) for a tenant's router: inserts the monitor_action_logs row as queued, then enqueues a monitor_action background job so the actual REST call happens in the worker (never inside the tRPC request). */
export async function recordTenantMonitorAction(input: { organizationId: number; userId: number; routerId: number; action: "reboot" | "shutdown" }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لتسجيل إجراء المراقبة");
  const router = await db.select({ id: routers.id }).from(routers)
    .where(and(eq(routers.id, input.routerId), eq(routers.organizationId, input.organizationId))).limit(1);
  if (!router[0]) throw new Error("الراوتر المحدد لا يتبع للمؤسسة");
  const logResult = await db.insert(monitorActionLogs).values({
    organizationId: input.organizationId, routerId: input.routerId, action: input.action, status: "queued", triggeredByUserId: input.userId,
  });
  const logId = Number(logResult[0]?.insertId);
  const idempotencyKey = `monitor_action:${input.organizationId}:${input.action}:${logId}`;
  await db.insert(backgroundJobs).values({
    organizationId: input.organizationId, routerId: input.routerId, type: "monitor_action", idempotencyKey, status: "queued",
    payload: JSON.stringify({ operation: "monitor_action", logId, routerId: input.routerId, action: input.action }),
  });
  return { id: logId, status: "queued" as const };
}

/** Persists the worker's result for a monitor action log row (sent/failed). */
export async function updateTenantMonitorActionStatus(input: { id: number; organizationId: number; status: "sent" | "failed"; errorMessage?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لتحديث إجراء المراقبة");
  await db.update(monitorActionLogs).set({ status: input.status, errorMessage: input.errorMessage ?? null })
    .where(and(eq(monitorActionLogs.id, input.id), eq(monitorActionLogs.organizationId, input.organizationId)));
}

export async function listTenantMonitorActionLogs(organizationId: number, options: { limit?: number; offset?: number } = {}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة سجل إجراءات المراقبة");
  return db.select({
    id: monitorActionLogs.id, routerId: monitorActionLogs.routerId, routerName: routers.name, action: monitorActionLogs.action,
    status: monitorActionLogs.status, errorMessage: monitorActionLogs.errorMessage, triggeredByUserId: monitorActionLogs.triggeredByUserId, createdAt: monitorActionLogs.createdAt,
  }).from(monitorActionLogs).leftJoin(routers, eq(monitorActionLogs.routerId, routers.id))
    .where(eq(monitorActionLogs.organizationId, organizationId)).orderBy(desc(monitorActionLogs.createdAt))
    .limit(pageSize(options.limit ?? 25)).offset(pageOffset(options.offset ?? 0));
}

// ===========================================================================
// POINTS / LOYALTY — per-organization settings (minimum purchase amount to
// earn points, on/off toggle), reward tiers, and a per-customer running
// balance kept in sync via an append-only ledger (mirrors the
// applyDebitCredit-style balance-update pattern used by the accounting
// module: every ledger entry both records history AND updates the
// denormalized balance in the same transaction).
// ===========================================================================

export async function getTenantPointsSettings(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة إعدادات النقاط");
  const result = await db.select().from(pointsSettings).where(eq(pointsSettings.organizationId, organizationId)).limit(1);
  return result[0] ?? { organizationId, minimumAmount: "0", isEnabled: 0 };
}

export async function saveTenantPointsSettings(input: { organizationId: number; minimumAmount: string; isEnabled: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لحفظ إعدادات النقاط");
  const values = { organizationId: input.organizationId, minimumAmount: input.minimumAmount, isEnabled: input.isEnabled ? 1 : 0 };
  await db.insert(pointsSettings).values(values).onDuplicateKeyUpdate({ set: values });
  return { organizationId: input.organizationId };
}

export async function listTenantPointsBenefitTiers(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة مستويات المزايا");
  return db.select({ id: pointsBenefitTiers.id, name: pointsBenefitTiers.name, requiredPoints: pointsBenefitTiers.requiredPoints, sortOrder: pointsBenefitTiers.sortOrder })
    .from(pointsBenefitTiers).where(eq(pointsBenefitTiers.organizationId, organizationId)).orderBy(pointsBenefitTiers.sortOrder);
}

export async function createTenantPointsBenefitTier(input: { organizationId: number; name: string; requiredPoints: number; sortOrder?: number }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لإنشاء مستوى المزايا");
  const result = await db.insert(pointsBenefitTiers).values({ organizationId: input.organizationId, name: input.name.trim(), requiredPoints: input.requiredPoints, sortOrder: input.sortOrder ?? 0 });
  return { id: Number(result[0]?.insertId), name: input.name.trim(), requiredPoints: input.requiredPoints };
}

export async function getTenantCustomerPointBalance(organizationId: number, customerId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة رصيد النقاط");
  const customer = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.id, customerId), eq(customers.organizationId, organizationId))).limit(1);
  if (!customer[0]) throw new Error("العميل المحدد لا يتبع للمؤسسة");
  const result = await db.select({ balance: customerPointBalances.balance }).from(customerPointBalances).where(eq(customerPointBalances.customerId, customerId)).limit(1);
  return { customerId, balance: result[0]?.balance ?? 0 };
}

export async function listTenantPointLedgerEntries(organizationId: number, options: { customerId?: number; limit?: number; offset?: number } = {}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة سجل حركة النقاط");
  const conditions = options.customerId ? and(eq(pointLedgerEntries.organizationId, organizationId), eq(pointLedgerEntries.customerId, options.customerId)) : eq(pointLedgerEntries.organizationId, organizationId);
  return db.select({ id: pointLedgerEntries.id, customerId: pointLedgerEntries.customerId, kind: pointLedgerEntries.kind, points: pointLedgerEntries.points, reason: pointLedgerEntries.reason, createdAt: pointLedgerEntries.createdAt })
    .from(pointLedgerEntries).where(conditions).orderBy(desc(pointLedgerEntries.createdAt)).limit(pageSize(options.limit ?? 25)).offset(pageOffset(options.offset ?? 0));
}

/** Posts an earn/redeem/adjust ledger entry and updates the customer's denormalized balance atomically. Redeem/adjust-down entries are validated so the balance never goes negative. */
export async function postTenantPointLedgerEntry(input: { organizationId: number; userId: number; customerId: number; kind: "earn" | "redeem" | "adjust"; points: number; reason?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لتسجيل حركة النقاط");
  const customer = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.id, input.customerId), eq(customers.organizationId, input.organizationId))).limit(1);
  if (!customer[0]) throw new Error("العميل المحدد لا يتبع للمؤسسة");
  if (input.points === 0) throw new Error("قيمة النقاط يجب أن تكون غير صفرية");
  const delta = input.kind === "redeem" ? -Math.abs(input.points) : input.kind === "earn" ? Math.abs(input.points) : input.points;
  return db.transaction(async tx => {
    const existing = await tx.select({ balance: customerPointBalances.balance }).from(customerPointBalances).where(eq(customerPointBalances.customerId, input.customerId)).limit(1);
    const currentBalance = existing[0]?.balance ?? 0;
    const nextBalance = currentBalance + delta;
    if (nextBalance < 0) throw new Error("لا يمكن أن يصبح رصيد النقاط سالبًا");
    if (existing[0]) {
      await tx.update(customerPointBalances).set({ balance: nextBalance }).where(eq(customerPointBalances.customerId, input.customerId));
    } else {
      await tx.insert(customerPointBalances).values({ organizationId: input.organizationId, customerId: input.customerId, balance: nextBalance });
    }
    const entry = await tx.insert(pointLedgerEntries).values({ organizationId: input.organizationId, customerId: input.customerId, kind: input.kind, points: input.points, reason: input.reason ?? null, createdByUserId: input.userId });
    return { id: Number(entry[0]?.insertId), balance: nextBalance };
  });
}

// ===========================================================================
// SMS GATEWAY — provider configuration (cloud/local modem, SIM slot count)
// with the provider secret stored via server/secrets.ts's
// integrationSecrets vault (kind "sms"), plus an outbound message log.
// The API process queues the message and a `sms_send` background job; the
// worker resolves secretRef and POSTs to the configured cloud gateway.
// ===========================================================================

export async function getTenantSmsSettings(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة إعدادات الرسائل");
  const result = await db.select({ id: smsSettings.id, serverType: smsSettings.serverType, simCardsCount: smsSettings.simCardsCount, defaultSimCard: smsSettings.defaultSimCard, sendingType: smsSettings.sendingType, hasSecret: smsSettings.secretRef })
    .from(smsSettings).where(eq(smsSettings.organizationId, organizationId)).limit(1);
  if (!result[0]) return { organizationId, serverType: "cloud" as const, simCardsCount: "one" as const, defaultSimCard: 1, sendingType: "auto" as const, hasSecret: false };
  return { organizationId, serverType: result[0].serverType, simCardsCount: result[0].simCardsCount, defaultSimCard: result[0].defaultSimCard, sendingType: result[0].sendingType, hasSecret: Boolean(result[0].hasSecret) };
}

export async function saveTenantSmsSettings(input: { organizationId: number; serverType: "cloud" | "local_modem"; simCardsCount: "one" | "two"; defaultSimCard: number; sendingType: "auto" | "manual"; secretValue?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لحفظ إعدادات الرسائل");
  let secretRef: string | undefined;
  if (input.secretValue) {
    const { setIntegrationSecret } = await import("./secrets");
    secretRef = await setIntegrationSecret({ organizationId: input.organizationId, kind: "sms", value: input.secretValue });
  }
  const values = { organizationId: input.organizationId, serverType: input.serverType, simCardsCount: input.simCardsCount, defaultSimCard: input.defaultSimCard, sendingType: input.sendingType, ...(secretRef ? { secretRef } : {}) };
  await db.insert(smsSettings).values(values).onDuplicateKeyUpdate({ set: values });
  return { organizationId: input.organizationId };
}

export async function listTenantSmsMessages(organizationId: number, options: { limit?: number; offset?: number } = {}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة سجل الرسائل");
  return db.select({ id: smsMessages.id, customerId: smsMessages.customerId, toNumber: smsMessages.toNumber, body: smsMessages.body, status: smsMessages.status, createdAt: smsMessages.createdAt })
    .from(smsMessages).where(eq(smsMessages.organizationId, organizationId)).orderBy(desc(smsMessages.createdAt)).limit(pageSize(options.limit ?? 25)).offset(pageOffset(options.offset ?? 0));
}

export async function getTenantSmsMessageForDispatch(messageId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة الرسالة");
  const message = await db.select({
    id: smsMessages.id,
    organizationId: smsMessages.organizationId,
    toNumber: smsMessages.toNumber,
    body: smsMessages.body,
    status: smsMessages.status,
  }).from(smsMessages).where(eq(smsMessages.id, messageId)).limit(1);
  if (!message[0]) return null;
  const settings = await db.select({
    serverType: smsSettings.serverType,
    secretRef: smsSettings.secretRef,
  }).from(smsSettings).where(eq(smsSettings.organizationId, message[0].organizationId)).limit(1);
  return {
    ...message[0],
    serverType: settings[0]?.serverType ?? "cloud" as const,
    secretRef: settings[0]?.secretRef ?? null,
  };
}

export async function markTenantSmsMessageStatus(input: { messageId: number; organizationId: number; status: "queued" | "sent" | "failed" }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لتحديث حالة الرسالة");
  await db.update(smsMessages).set({ status: input.status }).where(and(eq(smsMessages.id, input.messageId), eq(smsMessages.organizationId, input.organizationId)));
  return { id: input.messageId, status: input.status };
}

/** Queues an outbound SMS row and enqueues a worker job that dispatches it through the configured cloud gateway. */
export async function queueTenantSmsMessage(input: { organizationId: number; userId: number; customerId?: number | null; toNumber: string; body: string }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لإرسال الرسالة");
  if (!input.toNumber.trim()) throw new Error("رقم الهاتف مطلوب");
  if (!input.body.trim()) throw new Error("نص الرسالة مطلوب");
  if (input.customerId) {
    const customer = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.id, input.customerId), eq(customers.organizationId, input.organizationId))).limit(1);
    if (!customer[0]) throw new Error("العميل المحدد لا يتبع للمؤسسة");
  }
  const result = await db.insert(smsMessages).values({ organizationId: input.organizationId, customerId: input.customerId ?? null, toNumber: input.toNumber.trim(), body: input.body.trim(), status: "queued", createdByUserId: input.userId });
  const messageId = Number(result[0]?.insertId);
  const idempotencyKey = `sms_send:${input.organizationId}:${messageId}`;
  await db.insert(backgroundJobs).values({ organizationId: input.organizationId, routerId: null, type: "sms_send", idempotencyKey, status: "queued", payload: JSON.stringify({ operation: "sms_send", messageId }) });
  return { id: messageId, status: "queued" as const };
}

// ===========================================================================
// COMPETITIONS / GAMIFICATION — quiz-style competitions with difficulty-
// weighted questions; a customer's entry auto-awards points sized by the
// competition's easy/medium/hard point values and is posted through the
// SAME point-ledger machinery as the points/loyalty module above, so a
// customer's balance always reflects both purchase-based and
// competition-based earnings from a single source of truth.
// ===========================================================================

const competitionStatusTransitions = { draft: ["active", "ended"], active: ["ended"], ended: [] } as const;

export async function listTenantCompetitions(organizationId: number, options: { status?: "draft" | "active" | "ended"; limit?: number; offset?: number } = {}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة المسابقات");
  const conditions = options.status ? and(eq(competitions.organizationId, organizationId), eq(competitions.status, options.status)) : eq(competitions.organizationId, organizationId);
  return db.select({ id: competitions.id, name: competitions.name, easyPoints: competitions.easyPoints, mediumPoints: competitions.mediumPoints, hardPoints: competitions.hardPoints, duration: competitions.duration, questionsPerDuration: competitions.questionsPerDuration, status: competitions.status, startsAt: competitions.startsAt, endsAt: competitions.endsAt, createdAt: competitions.createdAt })
    .from(competitions).where(conditions).orderBy(desc(competitions.createdAt)).limit(pageSize(options.limit ?? 25)).offset(pageOffset(options.offset ?? 0));
}

export async function createTenantCompetition(input: { organizationId: number; userId: number; name: string; easyPoints?: number; mediumPoints?: number; hardPoints?: number; duration?: "daily" | "weekly" | "one_time"; questionsPerDuration?: number; startsAt?: Date | null; endsAt?: Date | null }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لإنشاء المسابقة");
  if (!input.name.trim()) throw new Error("اسم المسابقة مطلوب");
  const result = await db.insert(competitions).values({ organizationId: input.organizationId, name: input.name.trim(), easyPoints: input.easyPoints ?? 5, mediumPoints: input.mediumPoints ?? 7, hardPoints: input.hardPoints ?? 10, duration: input.duration ?? "daily", questionsPerDuration: input.questionsPerDuration ?? 10, status: "draft", startsAt: input.startsAt ?? null, endsAt: input.endsAt ?? null, createdByUserId: input.userId });
  return { id: Number(result[0]?.insertId), name: input.name.trim(), status: "draft" as const };
}

export async function updateTenantCompetitionStatus(input: { organizationId: number; competitionId: number; status: "draft" | "active" | "ended" }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لتحديث حالة المسابقة");
  const current = await db.select({ id: competitions.id, status: competitions.status }).from(competitions).where(and(eq(competitions.id, input.competitionId), eq(competitions.organizationId, input.organizationId))).limit(1);
  if (!current[0]) throw new Error("المسابقة المحددة لا تتبع للمؤسسة");
  const allowed = competitionStatusTransitions[current[0].status] as readonly string[];
  if (current[0].status !== input.status && !allowed.includes(input.status)) throw new Error(`لا يمكن تغيير حالة المسابقة من ${current[0].status} إلى ${input.status}`);
  await db.update(competitions).set({ status: input.status }).where(eq(competitions.id, input.competitionId));
  return { id: input.competitionId, status: input.status };
}

export async function listTenantCompetitionQuestions(organizationId: number, competitionId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة أسئلة المسابقة");
  const competition = await db.select({ id: competitions.id }).from(competitions).where(and(eq(competitions.id, competitionId), eq(competitions.organizationId, organizationId))).limit(1);
  if (!competition[0]) throw new Error("المسابقة المحددة لا تتبع للمؤسسة");
  return db.select({ id: competitionQuestions.id, difficulty: competitionQuestions.difficulty, question: competitionQuestions.question, correctAnswer: competitionQuestions.correctAnswer })
    .from(competitionQuestions).where(eq(competitionQuestions.competitionId, competitionId)).orderBy(competitionQuestions.id);
}

export async function createTenantCompetitionQuestion(input: { organizationId: number; competitionId: number; difficulty: "easy" | "medium" | "hard"; question: string; correctAnswer: string }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لإنشاء السؤال");
  const competition = await db.select({ id: competitions.id }).from(competitions).where(and(eq(competitions.id, input.competitionId), eq(competitions.organizationId, input.organizationId))).limit(1);
  if (!competition[0]) throw new Error("المسابقة المحددة لا تتبع للمؤسسة");
  if (!input.question.trim() || !input.correctAnswer.trim()) throw new Error("نص السؤال والإجابة الصحيحة مطلوبان");
  const result = await db.insert(competitionQuestions).values({ competitionId: input.competitionId, difficulty: input.difficulty, question: input.question.trim(), correctAnswer: input.correctAnswer.trim() });
  return { id: Number(result[0]?.insertId) };
}

/** Records a customer's competition entry (one per customer per competition, enforced by the unique index) and awards points sized by the question's difficulty, posted through postTenantPointLedgerEntry so the ledger stays the single source of truth for point balances. */
export async function submitTenantCompetitionEntry(input: { organizationId: number; userId: number; competitionId: number; customerId: number; questionId: number; answer: string }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لتسجيل المشاركة");
  const competition = await db.select({ id: competitions.id, status: competitions.status, easyPoints: competitions.easyPoints, mediumPoints: competitions.mediumPoints, hardPoints: competitions.hardPoints }).from(competitions)
    .where(and(eq(competitions.id, input.competitionId), eq(competitions.organizationId, input.organizationId))).limit(1);
  if (!competition[0]) throw new Error("المسابقة المحددة لا تتبع للمؤسسة");
  if (competition[0].status !== "active") throw new Error("المسابقة غير نشطة حاليًا");
  const question = await db.select({ id: competitionQuestions.id, difficulty: competitionQuestions.difficulty, correctAnswer: competitionQuestions.correctAnswer }).from(competitionQuestions)
    .where(and(eq(competitionQuestions.id, input.questionId), eq(competitionQuestions.competitionId, input.competitionId))).limit(1);
  if (!question[0]) throw new Error("السؤال المحدد لا يتبع لهذه المسابقة");
  const existingEntry = await db.select({ id: competitionEntries.id }).from(competitionEntries).where(and(eq(competitionEntries.competitionId, input.competitionId), eq(competitionEntries.customerId, input.customerId))).limit(1);
  if (existingEntry[0]) throw new Error("العميل قد شارك في هذه المسابقة مسبقًا");
  const isCorrect = question[0].correctAnswer.trim().toLowerCase() === input.answer.trim().toLowerCase();
  const pointsByDifficulty = { easy: competition[0].easyPoints, medium: competition[0].mediumPoints, hard: competition[0].hardPoints } as const;
  const pointsEarned = isCorrect ? pointsByDifficulty[question[0].difficulty] : 0;
  await db.insert(competitionEntries).values({ competitionId: input.competitionId, customerId: input.customerId, pointsEarned });
  if (pointsEarned > 0) {
    await postTenantPointLedgerEntry({ organizationId: input.organizationId, userId: input.userId, customerId: input.customerId, kind: "earn", points: pointsEarned, reason: `مسابقة #${input.competitionId}` });
  }
  return { correct: isCorrect, pointsEarned };
}

// ===========================================================================
// LIVE CHAT SUPPORT — customer-facing chat threads, additive to the
// existing async supportTickets/supportMessages system. Polled by the
// client (no persistent WebSocket server, matching the Cloudflare-Workers-
// compatible design philosophy noted elsewhere in this file) for
// near-real-time delivery.
// ===========================================================================

export async function listTenantChatThreads(organizationId: number, options: { status?: "open" | "closed"; limit?: number; offset?: number } = {}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة محادثات الدعم");
  const conditions = options.status ? and(eq(chatThreads.organizationId, organizationId), eq(chatThreads.status, options.status)) : eq(chatThreads.organizationId, organizationId);
  return db.select({ id: chatThreads.id, customerId: chatThreads.customerId, subject: chatThreads.subject, status: chatThreads.status, lastMessageAt: chatThreads.lastMessageAt, createdAt: chatThreads.createdAt })
    .from(chatThreads).where(conditions).orderBy(desc(chatThreads.lastMessageAt)).limit(pageSize(options.limit ?? 25)).offset(pageOffset(options.offset ?? 0));
}

export async function createTenantChatThread(input: { organizationId: number; customerId?: number | null; subject?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لإنشاء المحادثة");
  if (input.customerId) {
    const customer = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.id, input.customerId), eq(customers.organizationId, input.organizationId))).limit(1);
    if (!customer[0]) throw new Error("العميل المحدد لا يتبع للمؤسسة");
  }
  const result = await db.insert(chatThreads).values({ organizationId: input.organizationId, customerId: input.customerId ?? null, subject: input.subject ?? null, status: "open" });
  return { id: Number(result[0]?.insertId), status: "open" as const };
}

export async function updateTenantChatThreadStatus(input: { organizationId: number; threadId: number; status: "open" | "closed" }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لتحديث حالة المحادثة");
  const thread = await db.select({ id: chatThreads.id }).from(chatThreads).where(and(eq(chatThreads.id, input.threadId), eq(chatThreads.organizationId, input.organizationId))).limit(1);
  if (!thread[0]) throw new Error("المحادثة المحددة لا تتبع للمؤسسة");
  await db.update(chatThreads).set({ status: input.status }).where(eq(chatThreads.id, input.threadId));
  return { id: input.threadId, status: input.status };
}

export async function listTenantChatMessages(organizationId: number, threadId: number, options: { limit?: number } = {}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة رسائل المحادثة");
  const thread = await db.select({ id: chatThreads.id }).from(chatThreads).where(and(eq(chatThreads.id, threadId), eq(chatThreads.organizationId, organizationId))).limit(1);
  if (!thread[0]) throw new Error("المحادثة المحددة لا تتبع للمؤسسة");
  return db.select({ id: chatMessages.id, senderKind: chatMessages.senderKind, senderUserId: chatMessages.senderUserId, body: chatMessages.body, createdAt: chatMessages.createdAt })
    .from(chatMessages).where(eq(chatMessages.threadId, threadId)).orderBy(chatMessages.createdAt).limit(pageSize(options.limit ?? 100));
}

export async function postTenantChatMessage(input: { organizationId: number; threadId: number; senderKind: "staff" | "customer"; senderUserId?: number | null; body: string }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لإرسال الرسالة");
  if (!input.body.trim()) throw new Error("نص الرسالة مطلوب");
  const thread = await db.select({ id: chatThreads.id, status: chatThreads.status }).from(chatThreads).where(and(eq(chatThreads.id, input.threadId), eq(chatThreads.organizationId, input.organizationId))).limit(1);
  if (!thread[0]) throw new Error("المحادثة المحددة لا تتبع للمؤسسة");
  if (thread[0].status === "closed") throw new Error("لا يمكن إضافة رسائل إلى محادثة مغلقة");
  const now = new Date();
  return db.transaction(async tx => {
    const result = await tx.insert(chatMessages).values({ organizationId: input.organizationId, threadId: input.threadId, senderKind: input.senderKind, senderUserId: input.senderUserId ?? null, body: input.body.trim(), createdAt: now });
    await tx.update(chatThreads).set({ lastMessageAt: now }).where(eq(chatThreads.id, input.threadId));
    return { id: Number(result[0]?.insertId), createdAt: now };
  });
}

// ===========================================================================
// API TOKENS / MAC SECURITY / HOTSPOT PAGES / REPORT BUILDER PRO /
// CARD IMPORT / BACKUP SCHEDULING / SMS TEMPLATES / DYNAMIC SETTINGS
// ===========================================================================

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; }
  catch { return fallback; }
}

function trimText(value: string | null | undefined) {
  return value?.trim() || null;
}

function maskTokenPrefix(prefix: string) {
  return `${prefix}••••`;
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Buffer.from(digest).toString("hex");
}

function newApiTokenPlaintext() {
  return `ntr_${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "")}`;
}

function normalizeMacAddress(value: string) {
  const raw = value.replace(/[^a-fA-F0-9]/g, "").toUpperCase();
  if (raw.length !== 12) throw new Error("عنوان MAC غير صالح");
  return raw.match(/.{1,2}/g)?.join(":") ?? value.trim().toUpperCase();
}

function renderSmsTemplateText(template: string, variables: Record<string, unknown>) {
  let output = template;
  output = output.replace(/\{\{#([a-zA-Z0-9_.-]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key: string, inner: string) => {
    const value = variables[key];
    return value ? inner : "";
  });
  output = output.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key: string) => {
    const value = variables[key];
    return value === null || value === undefined ? "" : String(value);
  });
  return output;
}

function nextBackupRunFor(frequency: "every_6h" | "every_12h" | "daily" | "weekly", from: Date) {
  const next = new Date(from);
  if (frequency === "every_6h") next.setUTCHours(next.getUTCHours() + 6);
  else if (frequency === "every_12h") next.setUTCHours(next.getUTCHours() + 12);
  else if (frequency === "daily") next.setUTCDate(next.getUTCDate() + 1);
  else next.setUTCDate(next.getUTCDate() + 7);
  return next;
}

export async function listTenantApiTokens(input: { organizationId: number; userId: number }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة رموز API");
  const rows = await db.select({
    id: apiTokens.id,
    name: apiTokens.name,
    tokenPrefix: apiTokens.tokenPrefix,
    abilities: apiTokens.abilities,
    ipAllowlist: apiTokens.ipAllowlist,
    lastUsedAt: apiTokens.lastUsedAt,
    expiresAt: apiTokens.expiresAt,
    revokedAt: apiTokens.revokedAt,
    createdAt: apiTokens.createdAt,
  }).from(apiTokens)
    .where(and(eq(apiTokens.organizationId, input.organizationId), eq(apiTokens.userId, input.userId)))
    .orderBy(desc(apiTokens.createdAt));
  return rows.map(row => ({
    ...row,
    tokenLabel: maskTokenPrefix(row.tokenPrefix),
    abilities: safeJsonParse<string[]>(row.abilities, []),
    ipAllowlist: safeJsonParse<string[]>(row.ipAllowlist, []),
  }));
}

export async function createTenantApiToken(input: { organizationId: number; userId: number; name: string; abilities: string[]; ipAllowlist?: string[]; expiresAt?: Date | null }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لإنشاء رمز API");
  const plain = newApiTokenPlaintext();
  const prefix = plain.slice(0, 12);
  const tokenHash = await sha256Hex(plain);
  const result = await db.insert(apiTokens).values({
    organizationId: input.organizationId,
    userId: input.userId,
    name: input.name.trim(),
    tokenHash,
    tokenPrefix: prefix,
    abilities: JSON.stringify(input.abilities),
    ipAllowlist: input.ipAllowlist?.length ? JSON.stringify(input.ipAllowlist) : null,
    expiresAt: input.expiresAt ?? null,
  });
  return { id: Number(result[0]?.insertId), name: input.name.trim(), token: plain, tokenPrefix: prefix };
}

export async function revokeTenantApiToken(input: { organizationId: number; userId: number; tokenId: number }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لإلغاء رمز API");
  const existing = await db.select({ id: apiTokens.id, revokedAt: apiTokens.revokedAt }).from(apiTokens)
    .where(and(eq(apiTokens.id, input.tokenId), eq(apiTokens.organizationId, input.organizationId), eq(apiTokens.userId, input.userId))).limit(1);
  if (!existing[0]) throw new Error("رمز API المحدد لا يتبع للمؤسسة");
  await db.update(apiTokens).set({ revokedAt: new Date() }).where(eq(apiTokens.id, input.tokenId));
  return { id: input.tokenId, revoked: true as const };
}

export async function listTenantMacSecurityRules(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة قواعد MAC Security");
  return db.select({
    id: macSecurityRules.id,
    macAddress: macSecurityRules.macAddress,
    listType: macSecurityRules.listType,
    reason: macSecurityRules.reason,
    customerId: macSecurityRules.customerId,
    customerName: customers.fullName,
    createdAt: macSecurityRules.createdAt,
  }).from(macSecurityRules)
    .leftJoin(customers, eq(macSecurityRules.customerId, customers.id))
    .where(eq(macSecurityRules.organizationId, organizationId))
    .orderBy(desc(macSecurityRules.createdAt));
}

export async function saveTenantMacSecurityRule(input: { organizationId: number; userId: number; macAddress: string; listType: "whitelist" | "blacklist"; reason?: string | null; customerId?: number | null }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لحفظ قاعدة MAC Security");
  const macAddress = normalizeMacAddress(input.macAddress);
  if (input.customerId) {
    const customer = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.id, input.customerId), eq(customers.organizationId, input.organizationId))).limit(1);
    if (!customer[0]) throw new Error("العميل المحدد لا يتبع للمؤسسة");
  }
  const result = await db.insert(macSecurityRules).values({
    organizationId: input.organizationId,
    macAddress,
    listType: input.listType,
    reason: trimText(input.reason),
    customerId: input.customerId ?? null,
    createdByUserId: input.userId,
  });
  return { id: Number(result[0]?.insertId), macAddress, listType: input.listType };
}

export async function deleteTenantMacSecurityRule(input: { organizationId: number; ruleId: number }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لحذف قاعدة MAC Security");
  const existing = await db.select({ id: macSecurityRules.id }).from(macSecurityRules)
    .where(and(eq(macSecurityRules.id, input.ruleId), eq(macSecurityRules.organizationId, input.organizationId))).limit(1);
  if (!existing[0]) throw new Error("القاعدة المحددة لا تتبع للمؤسسة");
  await db.delete(macSecurityRules).where(eq(macSecurityRules.id, input.ruleId));
  return { id: input.ruleId, deleted: true as const };
}

export async function listTenantMacSecurityActionLogs(organizationId: number, options: { limit?: number; offset?: number } = {}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة سجل MAC Security");
  return db.select({
    id: macSecurityActionLogs.id,
    macAddress: macSecurityActionLogs.macAddress,
    action: macSecurityActionLogs.action,
    triggeredByUserId: macSecurityActionLogs.triggeredByUserId,
    createdAt: macSecurityActionLogs.createdAt,
  }).from(macSecurityActionLogs)
    .where(eq(macSecurityActionLogs.organizationId, organizationId))
    .orderBy(desc(macSecurityActionLogs.createdAt))
    .limit(pageSize(options.limit ?? 25)).offset(pageOffset(options.offset ?? 0));
}

export async function recordTenantMacSecurityAction(input: { organizationId: number; userId: number; macAddress: string; action: "block" | "unblock" }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لتسجيل إجراء MAC Security");
  const macAddress = normalizeMacAddress(input.macAddress);
  const result = await db.insert(macSecurityActionLogs).values({
    organizationId: input.organizationId,
    macAddress,
    action: input.action,
    triggeredByUserId: input.userId,
  });
  return { id: Number(result[0]?.insertId), macAddress, action: input.action };
}

export async function listTenantHotspotLoginPages(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة صفحات الدخول");
  const rows = await db.select({
    id: hotspotLoginPages.id,
    name: hotspotLoginPages.name,
    isDefault: hotspotLoginPages.isDefault,
    logoImageKey: hotspotLoginPages.logoImageKey,
    backgroundImageKey: hotspotLoginPages.backgroundImageKey,
    primaryColor: hotspotLoginPages.primaryColor,
    welcomeTitle: hotspotLoginPages.welcomeTitle,
    welcomeBody: hotspotLoginPages.welcomeBody,
    termsText: hotspotLoginPages.termsText,
    voucherGroupScope: hotspotLoginPages.voucherGroupScope,
    updatedAt: hotspotLoginPages.updatedAt,
  }).from(hotspotLoginPages)
    .where(eq(hotspotLoginPages.organizationId, organizationId))
    .orderBy(desc(hotspotLoginPages.updatedAt));
  return rows.map(row => ({ ...row, isDefault: Boolean(row.isDefault), voucherGroupScope: safeJsonParse<number[]>(row.voucherGroupScope, []) }));
}

export async function saveTenantHotspotLoginPage(input: { organizationId: number; userId: number; pageId?: number | null; name: string; isDefault?: boolean; logoImageKey?: string | null; backgroundImageKey?: string | null; primaryColor?: string | null; welcomeTitle?: string | null; welcomeBody?: string | null; termsText?: string | null; voucherGroupScope?: number[] }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لحفظ صفحة الدخول");
  const scopeJson = input.voucherGroupScope?.length ? JSON.stringify(input.voucherGroupScope) : null;
  return db.transaction(async tx => {
    if (input.isDefault) {
      await tx.update(hotspotLoginPages).set({ isDefault: 0 }).where(eq(hotspotLoginPages.organizationId, input.organizationId));
    }
    const values = {
      name: input.name.trim(),
      isDefault: input.isDefault ? 1 : 0,
      logoImageKey: trimText(input.logoImageKey),
      backgroundImageKey: trimText(input.backgroundImageKey),
      primaryColor: trimText(input.primaryColor) ?? "#6d28d9",
      welcomeTitle: trimText(input.welcomeTitle),
      welcomeBody: trimText(input.welcomeBody),
      termsText: trimText(input.termsText),
      voucherGroupScope: scopeJson,
    };
    if (input.pageId) {
      const existing = await tx.select({ id: hotspotLoginPages.id }).from(hotspotLoginPages).where(and(eq(hotspotLoginPages.id, input.pageId), eq(hotspotLoginPages.organizationId, input.organizationId))).limit(1);
      if (!existing[0]) throw new Error("صفحة الدخول المحددة لا تتبع للمؤسسة");
      await tx.update(hotspotLoginPages).set(values).where(eq(hotspotLoginPages.id, input.pageId));
      return { id: input.pageId, name: input.name.trim() };
    }
    const result = await tx.insert(hotspotLoginPages).values({ organizationId: input.organizationId, createdByUserId: input.userId, ...values });
    return { id: Number(result[0]?.insertId), name: input.name.trim() };
  });
}

export async function deleteTenantHotspotLoginPage(input: { organizationId: number; pageId: number }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لحذف صفحة الدخول");
  const existing = await db.select({ id: hotspotLoginPages.id }).from(hotspotLoginPages)
    .where(and(eq(hotspotLoginPages.id, input.pageId), eq(hotspotLoginPages.organizationId, input.organizationId))).limit(1);
  if (!existing[0]) throw new Error("صفحة الدخول المحددة لا تتبع للمؤسسة");
  await db.delete(hotspotLoginPages).where(eq(hotspotLoginPages.id, input.pageId));
  return { id: input.pageId, deleted: true as const };
}

export async function getTenantReportBuilderAccess(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة وصول منشئ التقارير");
  const row = await db.select({ organizationId: reportBuilderAccess.organizationId, pinHash: reportBuilderAccess.pinHash, updatedAt: reportBuilderAccess.updatedAt })
    .from(reportBuilderAccess).where(eq(reportBuilderAccess.organizationId, organizationId)).limit(1);
  return { hasPin: Boolean(row[0]?.pinHash), updatedAt: row[0]?.updatedAt ?? null };
}

export async function saveTenantReportBuilderAccessPin(input: { organizationId: number; pin?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لحفظ PIN منشئ التقارير");
  const pinHash = input.pin ? await bcrypt.hash(input.pin, 10) : null;
  await db.insert(reportBuilderAccess).values({ organizationId: input.organizationId, pinHash })
    .onDuplicateKeyUpdate({ set: { pinHash } });
  return { organizationId: input.organizationId, hasPin: Boolean(pinHash) };
}

export async function verifyTenantReportBuilderPin(input: { organizationId: number; pin: string }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة للتحقق من PIN منشئ التقارير");
  const row = await db.select({ pinHash: reportBuilderAccess.pinHash }).from(reportBuilderAccess).where(eq(reportBuilderAccess.organizationId, input.organizationId)).limit(1);
  if (!row[0]?.pinHash) return { valid: true };
  return { valid: await bcrypt.compare(input.pin, row[0].pinHash) };
}

export async function listTenantReportCategories(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة فئات التقارير");
  return db.select({ id: reportCategories.id, name: reportCategories.name, sortOrder: reportCategories.sortOrder, createdAt: reportCategories.createdAt })
    .from(reportCategories).where(eq(reportCategories.organizationId, organizationId)).orderBy(reportCategories.sortOrder, desc(reportCategories.createdAt));
}

export async function saveTenantReportCategory(input: { organizationId: number; name: string; sortOrder?: number }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لحفظ فئة التقرير");
  const result = await db.insert(reportCategories).values({ organizationId: input.organizationId, name: input.name.trim(), sortOrder: input.sortOrder ?? 0 });
  return { id: Number(result[0]?.insertId), name: input.name.trim() };
}

export async function listTenantReportParameterDefinitions(input: { organizationId: number; reportDefinitionId: number }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة معلمات التقرير");
  const definition = await db.select({ id: reportDefinitions.id }).from(reportDefinitions).where(and(eq(reportDefinitions.id, input.reportDefinitionId), eq(reportDefinitions.organizationId, input.organizationId))).limit(1);
  if (!definition[0]) throw new Error("تعريف التقرير المحدد لا يتبع للمؤسسة");
  const rows = await db.select({ id: reportParameterDefinitions.id, key: reportParameterDefinitions.key, label: reportParameterDefinitions.label, fieldType: reportParameterDefinitions.fieldType, expectedValues: reportParameterDefinitions.expectedValues, isRequired: reportParameterDefinitions.isRequired, sortOrder: reportParameterDefinitions.sortOrder })
    .from(reportParameterDefinitions).where(eq(reportParameterDefinitions.reportDefinitionId, input.reportDefinitionId)).orderBy(reportParameterDefinitions.sortOrder, reportParameterDefinitions.id);
  return rows.map(row => ({ ...row, isRequired: Boolean(row.isRequired), expectedValues: safeJsonParse<string[]>(row.expectedValues, []) }));
}

export async function saveTenantReportParameterDefinitions(input: { organizationId: number; reportDefinitionId: number; parameters: { key: string; label: string; fieldType: "text" | "number" | "date" | "date_range" | "select" | "sort"; expectedValues?: string[]; isRequired?: boolean; sortOrder?: number }[] }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لحفظ معلمات التقرير");
  const definition = await db.select({ id: reportDefinitions.id }).from(reportDefinitions).where(and(eq(reportDefinitions.id, input.reportDefinitionId), eq(reportDefinitions.organizationId, input.organizationId))).limit(1);
  if (!definition[0]) throw new Error("تعريف التقرير المحدد لا يتبع للمؤسسة");
  await db.transaction(async tx => {
    await tx.delete(reportParameterDefinitions).where(eq(reportParameterDefinitions.reportDefinitionId, input.reportDefinitionId));
    if (input.parameters.length) {
      await tx.insert(reportParameterDefinitions).values(input.parameters.map((parameter, index) => ({
        reportDefinitionId: input.reportDefinitionId,
        key: parameter.key.trim(),
        label: parameter.label.trim(),
        fieldType: parameter.fieldType,
        expectedValues: parameter.expectedValues?.length ? JSON.stringify(parameter.expectedValues) : null,
        isRequired: parameter.isRequired ? 1 : 0,
        sortOrder: parameter.sortOrder ?? index + 1,
      })));
    }
  });
  return { reportDefinitionId: input.reportDefinitionId, count: input.parameters.length };
}

export async function listTenantReportSavedFilters(input: { organizationId: number; reportDefinitionId: number }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة الفلاتر المحفوظة");
  const definition = await db.select({ id: reportDefinitions.id }).from(reportDefinitions).where(and(eq(reportDefinitions.id, input.reportDefinitionId), eq(reportDefinitions.organizationId, input.organizationId))).limit(1);
  if (!definition[0]) throw new Error("تعريف التقرير المحدد لا يتبع للمؤسسة");
  const rows = await db.select({ id: reportSavedFilters.id, name: reportSavedFilters.name, filterJson: reportSavedFilters.filterJson, isShared: reportSavedFilters.isShared, createdAt: reportSavedFilters.createdAt })
    .from(reportSavedFilters).where(eq(reportSavedFilters.reportDefinitionId, input.reportDefinitionId)).orderBy(desc(reportSavedFilters.createdAt));
  return rows.map(row => ({ ...row, filterJson: safeJsonParse<Record<string, unknown>>(row.filterJson, {}), isShared: Boolean(row.isShared) }));
}

export async function saveTenantReportSavedFilter(input: { organizationId: number; userId: number; reportDefinitionId: number; name: string; filterJson: Record<string, unknown>; isShared?: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لحفظ الفلتر");
  const definition = await db.select({ id: reportDefinitions.id }).from(reportDefinitions).where(and(eq(reportDefinitions.id, input.reportDefinitionId), eq(reportDefinitions.organizationId, input.organizationId))).limit(1);
  if (!definition[0]) throw new Error("تعريف التقرير المحدد لا يتبع للمؤسسة");
  const result = await db.insert(reportSavedFilters).values({
    reportDefinitionId: input.reportDefinitionId,
    name: input.name.trim(),
    filterJson: JSON.stringify(input.filterJson ?? {}),
    isShared: input.isShared ? 1 : 0,
    createdByUserId: input.userId,
  });
  return { id: Number(result[0]?.insertId), name: input.name.trim() };
}

export async function listTenantReportScheduleDeliveries(input: { organizationId: number; reportScheduleId: number }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة وجهات التسليم");
  const schedule = await db.select({ id: reportSchedules.id }).from(reportSchedules).where(and(eq(reportSchedules.id, input.reportScheduleId), eq(reportSchedules.organizationId, input.organizationId))).limit(1);
  if (!schedule[0]) throw new Error("الجدولة المحددة لا تتبع للمؤسسة");
  return db.select({ id: reportScheduleDeliveries.id, channel: reportScheduleDeliveries.channel, target: reportScheduleDeliveries.target, lastDeliveryStatus: reportScheduleDeliveries.lastDeliveryStatus, lastDeliveryAt: reportScheduleDeliveries.lastDeliveryAt, failureCount: reportScheduleDeliveries.failureCount, createdAt: reportScheduleDeliveries.createdAt })
    .from(reportScheduleDeliveries).where(eq(reportScheduleDeliveries.reportScheduleId, input.reportScheduleId)).orderBy(desc(reportScheduleDeliveries.createdAt));
}

export async function saveTenantReportScheduleDeliveries(input: { organizationId: number; reportScheduleId: number; deliveries: { channel: "email" | "telegram"; target: string }[] }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لحفظ وجهات التسليم");
  const schedule = await db.select({ id: reportSchedules.id }).from(reportSchedules).where(and(eq(reportSchedules.id, input.reportScheduleId), eq(reportSchedules.organizationId, input.organizationId))).limit(1);
  if (!schedule[0]) throw new Error("الجدولة المحددة لا تتبع للمؤسسة");
  await db.transaction(async tx => {
    await tx.delete(reportScheduleDeliveries).where(eq(reportScheduleDeliveries.reportScheduleId, input.reportScheduleId));
    if (input.deliveries.length) {
      await tx.insert(reportScheduleDeliveries).values(input.deliveries.map(delivery => ({ reportScheduleId: input.reportScheduleId, channel: delivery.channel, target: delivery.target.trim() })));
    }
  });
  return { reportScheduleId: input.reportScheduleId, count: input.deliveries.length };
}

export async function listTenantReportScheduleLogs(organizationId: number, options: { limit?: number; offset?: number } = {}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة سجل جدولات التقارير");
  return db.select({ id: reportScheduleLogs.id, reportScheduleId: reportScheduleLogs.reportScheduleId, level: reportScheduleLogs.level, message: reportScheduleLogs.message, createdAt: reportScheduleLogs.createdAt })
    .from(reportScheduleLogs).where(eq(reportScheduleLogs.organizationId, organizationId)).orderBy(desc(reportScheduleLogs.createdAt))
    .limit(pageSize(options.limit ?? 25)).offset(pageOffset(options.offset ?? 0));
}

export async function listTenantCardImportJobs(organizationId: number, options: { limit?: number; offset?: number } = {}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة مهام استيراد البطاقات");
  return db.select({ id: cardImportJobs.id, source: cardImportJobs.source, status: cardImportJobs.status, totalRows: cardImportJobs.totalRows, importedRows: cardImportJobs.importedRows, duplicateRows: cardImportJobs.duplicateRows, invalidRows: cardImportJobs.invalidRows, quotaExceeded: cardImportJobs.quotaExceeded, errorLog: cardImportJobs.errorLog, createdAt: cardImportJobs.createdAt, completedAt: cardImportJobs.completedAt })
    .from(cardImportJobs).where(eq(cardImportJobs.organizationId, organizationId)).orderBy(desc(cardImportJobs.createdAt))
    .limit(pageSize(options.limit ?? 25)).offset(pageOffset(options.offset ?? 0));
}

export async function createTenantCardImportJob(input: { organizationId: number; userId: number; source: "csv" | "mikrotik_sqlite" | "mikrotik_wizard"; content?: string | null; fileId?: number | null; servicePlanId?: number | null }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لإنشاء مهمة الاستيراد");
  if (input.fileId) {
    const file = await db.select({ id: files.id }).from(files).where(and(eq(files.id, input.fileId), eq(files.organizationId, input.organizationId))).limit(1);
    if (!file[0]) throw new Error("الملف المحدد لا يتبع للمؤسسة");
  }
  const { parseVoucherCsv, planVoucherInserts } = await import("./voucherImport");
  let parsed: { accepted: Array<{ code: string; serial?: string }>; rejected: number; duplicates: number };
  try {
    parsed = parseVoucherCsv(input.content ?? "");
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تحليل ملف الاستيراد";
    const now = new Date();
    const failed = await db.insert(cardImportJobs).values({
      organizationId: input.organizationId,
      source: input.source,
      status: "failed",
      fileId: input.fileId ?? null,
      totalRows: 0,
      importedRows: 0,
      duplicateRows: 0,
      invalidRows: 0,
      quotaExceeded: message.includes("5000") ? 1 : 0,
      errorLog: message,
      createdByUserId: input.userId,
      completedAt: now,
    });
    return { id: Number(failed[0]?.insertId), status: "failed" as const, totalRows: 0, importedRows: 0, duplicateRows: 0, invalidRows: 0, quotaExceeded: message.includes("5000") };
  }
  const totalRows = parsed.accepted.length + parsed.rejected + parsed.duplicates;
  if (!input.servicePlanId) throw new Error("باقة الخدمة مطلوبة لاستيراد القسائم");
  const plan = await db.select({ id: servicePlans.id, status: servicePlans.status }).from(servicePlans)
    .where(and(eq(servicePlans.id, input.servicePlanId), eq(servicePlans.organizationId, input.organizationId))).limit(1);
  if (!plan[0]) throw new Error("الباقة المحددة لا تتبع للمؤسسة");
  if (plan[0].status !== "active") throw new Error("يجب تفعيل الباقة قبل استيراد البطاقات");
  const existingVouchers = await db.select({ codeHash: vouchers.codeHash, serial: vouchers.serial }).from(vouchers)
    .where(eq(vouchers.organizationId, input.organizationId));
  const existingHashes = new Set(existingVouchers.map(row => row.codeHash));
  const existingSerials = new Set(existingVouchers.map(row => row.serial));
  const existingCodeKeys = new Set<string>();
  for (const row of parsed.accepted) {
    const hash = await hashVoucherCode(row.code);
    if (existingHashes.has(hash)) existingCodeKeys.add(row.code.toLowerCase());
  }
  const importReference = `IMP-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const planned = planVoucherInserts({ accepted: parsed.accepted, existingCodeKeys, existingSerials, importReference });
  const hashes = await Promise.all(planned.inserts.map(row => hashVoucherCode(row.code)));
  const now = new Date();
  const importedRows = planned.inserts.length;
  const duplicateRows = parsed.duplicates + planned.skippedExisting;
  const invalidRows = parsed.rejected + planned.serialConflicts;
  const result = await db.transaction(async tx => {
    if (planned.inserts.length) {
      await tx.insert(vouchers).values(planned.inserts.map((row, index) => ({
        organizationId: input.organizationId,
        servicePlanId: input.servicePlanId as number,
        codeHash: hashes[index],
        serial: row.serial,
        status: "new" as const,
      })));
    }
    const job = await tx.insert(cardImportJobs).values({
      organizationId: input.organizationId,
      source: input.source,
      status: "ready",
      fileId: input.fileId ?? null,
      totalRows,
      importedRows,
      duplicateRows,
      invalidRows,
      quotaExceeded: 0,
      errorLog: importedRows === 0 && totalRows > 0 ? "لم تُدرج أي قسائم جديدة" : null,
      createdByUserId: input.userId,
      completedAt: now,
    });
    return Number(job[0]?.insertId);
  });
  return { id: result, status: "ready" as const, totalRows, importedRows, duplicateRows, invalidRows, quotaExceeded: false };
}

export async function getTenantBackupSchedule(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة جدولة النسخ الاحتياطية");
  const row = await db.select().from(backupSchedules).where(eq(backupSchedules.organizationId, organizationId)).limit(1);
  return row[0] ? { ...row[0], isEnabled: Boolean(row[0].isEnabled) } : { organizationId, frequency: "daily" as const, retentionDays: 30, isEnabled: true, lastRunAt: null, nextRunAt: null, updatedAt: null };
}

export async function saveTenantBackupSchedule(input: { organizationId: number; frequency: "every_6h" | "every_12h" | "daily" | "weekly"; retentionDays: number; isEnabled: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لحفظ جدولة النسخ الاحتياطية");
  const nextRunAt = input.isEnabled ? nextBackupRunFor(input.frequency, new Date()) : null;
  await db.insert(backupSchedules).values({
    organizationId: input.organizationId,
    frequency: input.frequency,
    retentionDays: input.retentionDays,
    isEnabled: input.isEnabled ? 1 : 0,
    nextRunAt,
  }).onDuplicateKeyUpdate({ set: { frequency: input.frequency, retentionDays: input.retentionDays, isEnabled: input.isEnabled ? 1 : 0, nextRunAt } });
  return { organizationId: input.organizationId, frequency: input.frequency, retentionDays: input.retentionDays, isEnabled: input.isEnabled, nextRunAt };
}

export async function enqueueTenantBackupRun(input: { organizationId: number; userId: number }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لإضافة مهمة النسخ الاحتياطي");
  const idempotencyKey = `backup_run:${input.organizationId}:${crypto.randomUUID()}`;
  const result = await db.insert(backgroundJobs).values({
    organizationId: input.organizationId, routerId: null, type: "backup_run", idempotencyKey, status: "queued",
    payload: JSON.stringify({ operation: "backup_run", organizationId: input.organizationId, userId: input.userId }),
  });
  return { id: Number(result[0]?.insertId), status: "queued" as const };
}

export async function runDueTenantBackupSchedule(organizationId: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const schedule = await db.select().from(backupSchedules).where(eq(backupSchedules.organizationId, organizationId)).limit(1);
  const row = schedule[0];
  if (!row || !row.isEnabled || !row.nextRunAt || row.nextRunAt > new Date()) return null;
  const enqueued = await enqueueTenantBackupRun({ organizationId, userId });
  await db.update(backupSchedules).set({ lastRunAt: new Date(), nextRunAt: nextBackupRunFor(row.frequency, new Date()) }).where(eq(backupSchedules.organizationId, organizationId));
  return enqueued;
}

export async function listTenantSmsTemplates(organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة قوالب الرسائل");
  return db.select({ id: smsTemplates.id, key: smsTemplates.key, name: smsTemplates.name, namespace: smsTemplates.namespace, body: smsTemplates.body, isSystem: smsTemplates.isSystem, createdAt: smsTemplates.createdAt, updatedAt: smsTemplates.updatedAt })
    .from(smsTemplates).where(eq(smsTemplates.organizationId, organizationId)).orderBy(desc(smsTemplates.updatedAt));
}

export async function saveTenantSmsTemplate(input: { organizationId: number; userId: number; templateId?: number | null; key: string; name: string; namespace: "direct" | "scheduled" | "custom"; body: string }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لحفظ قالب الرسالة");
  const values = { key: input.key.trim(), name: input.name.trim(), namespace: input.namespace, body: input.body.trim() };
  if (input.templateId) {
    const existing = await db.select({ id: smsTemplates.id, isSystem: smsTemplates.isSystem }).from(smsTemplates)
      .where(and(eq(smsTemplates.id, input.templateId), eq(smsTemplates.organizationId, input.organizationId))).limit(1);
    if (!existing[0]) throw new Error("القالب المحدد لا يتبع للمؤسسة");
    if (existing[0].isSystem) throw new Error("لا يمكن تعديل قالب نظامي");
    await db.update(smsTemplates).set(values).where(eq(smsTemplates.id, input.templateId));
    return { id: input.templateId, name: values.name };
  }
  const result = await db.insert(smsTemplates).values({ organizationId: input.organizationId, createdByUserId: input.userId, isSystem: 0, ...values });
  return { id: Number(result[0]?.insertId), name: values.name };
}

export async function renderTenantSmsTemplate(input: { organizationId: number; templateId: number; variables: Record<string, unknown> }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لمعاينة قالب الرسالة");
  const existing = await db.select({ id: smsTemplates.id, body: smsTemplates.body }).from(smsTemplates)
    .where(and(eq(smsTemplates.id, input.templateId), eq(smsTemplates.organizationId, input.organizationId))).limit(1);
  if (!existing[0]) throw new Error("القالب المحدد لا يتبع للمؤسسة");
  return { body: renderSmsTemplateText(existing[0].body, input.variables) };
}

export async function listTenantDynamicSettingsItems(input: { organizationId: number; module: string }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة الإعدادات الديناميكية");
  const rows = await db.select({
    id: dynamicSettingsItems.id,
    module: dynamicSettingsItems.module,
    key: dynamicSettingsItems.key,
    label: dynamicSettingsItems.label,
    fieldType: dynamicSettingsItems.fieldType,
    expectedValues: dynamicSettingsItems.expectedValues,
    conditionField: dynamicSettingsItems.conditionField,
    conditionOp: dynamicSettingsItems.conditionOp,
    conditionValue: dynamicSettingsItems.conditionValue,
    minValue: dynamicSettingsItems.minValue,
    maxValue: dynamicSettingsItems.maxValue,
    notice: dynamicSettingsItems.notice,
    sortOrder: dynamicSettingsItems.sortOrder,
    value: dynamicSettingsItems.value,
    updatedAt: dynamicSettingsItems.updatedAt,
  }).from(dynamicSettingsItems)
    .where(and(eq(dynamicSettingsItems.organizationId, input.organizationId), eq(dynamicSettingsItems.module, input.module.trim())))
    .orderBy(dynamicSettingsItems.sortOrder, dynamicSettingsItems.id);
  return rows.map(row => ({ ...row, expectedValues: safeJsonParse<string[]>(row.expectedValues, []) }));
}

export async function saveTenantDynamicSettingsItems(input: { organizationId: number; userId: number; module: string; items: { key: string; label: string; fieldType: "select" | "text" | "checkbox" | "time" | "textarea" | "number"; expectedValues?: string[]; conditionField?: string | null; conditionOp?: string | null; conditionValue?: string | null; minValue?: number | null; maxValue?: number | null; notice?: string | null; sortOrder?: number | string; value?: string | null }[] }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لحفظ الإعدادات الديناميكية");
  await db.transaction(async tx => {
    for (const item of input.items) {
      await tx.insert(dynamicSettingsItems).values({
        organizationId: input.organizationId,
        module: input.module.trim(),
        key: item.key.trim(),
        label: item.label.trim(),
        fieldType: item.fieldType,
        expectedValues: item.expectedValues?.length ? JSON.stringify(item.expectedValues) : null,
        conditionField: trimText(item.conditionField),
        conditionOp: trimText(item.conditionOp),
        conditionValue: trimText(item.conditionValue),
        minValue: item.minValue ?? null,
        maxValue: item.maxValue ?? null,
        notice: trimText(item.notice),
        sortOrder: String(item.sortOrder ?? 1),
        value: item.value ?? null,
        updatedByUserId: input.userId,
      }).onDuplicateKeyUpdate({
        set: {
          label: item.label.trim(),
          fieldType: item.fieldType,
          expectedValues: item.expectedValues?.length ? JSON.stringify(item.expectedValues) : null,
          conditionField: trimText(item.conditionField),
          conditionOp: trimText(item.conditionOp),
          conditionValue: trimText(item.conditionValue),
          minValue: item.minValue ?? null,
          maxValue: item.maxValue ?? null,
          notice: trimText(item.notice),
          sortOrder: String(item.sortOrder ?? 1),
          value: item.value ?? null,
          updatedByUserId: input.userId,
        },
      });
    }
  });
  return { module: input.module.trim(), count: input.items.length };
}


export async function listTenantVoucherBulkActions(organizationId: number, options: { limit?: number; offset?: number } = {}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة العمليات المجمعة");
  const rows = await db.select({
    id: voucherBulkActions.id,
    actionType: voucherBulkActions.actionType,
    voucherIds: voucherBulkActions.voucherIds,
    status: voucherBulkActions.status,
    affectedCount: voucherBulkActions.affectedCount,
    createdAt: voucherBulkActions.createdAt,
    completedAt: voucherBulkActions.completedAt,
  }).from(voucherBulkActions)
    .where(eq(voucherBulkActions.organizationId, organizationId))
    .orderBy(desc(voucherBulkActions.createdAt))
    .limit(pageSize(options.limit ?? 20))
    .offset(pageOffset(options.offset ?? 0));

  return rows.map(row => {
    const ids = safeJsonParse<number[]>(row.voucherIds, []);
    const totalCards = Array.isArray(ids) ? ids.length : 0;
    return {
      id: row.id,
      action: row.actionType,
      status: row.status,
      totalCards,
      affectedCards: row.affectedCount,
      failedCards: Math.max(0, totalCards - row.affectedCount),
      createdAt: row.createdAt,
      completedAt: row.completedAt,
    };
  });
}

export async function createTenantVoucherBulkAction(input: { organizationId: number; userId: number; action: "delete" | "group_change" | "stop"; serials: string[]; targetGroupId?: number | null }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لتنفيذ العملية المجمعة");

  const cleanedSerials = Array.from(new Set(input.serials.map(item => item.trim()).filter(Boolean)));
  if (!cleanedSerials.length) throw new Error("أدخل رقم بطاقة واحدًا على الأقل");
  if (cleanedSerials.length > 1000) throw new Error("الحد الأقصى للعملية المجمعة هو 1000 بطاقة");

  const rows = await db.select({ id: vouchers.id, serial: vouchers.serial }).from(vouchers)
    .where(and(eq(vouchers.organizationId, input.organizationId), inArray(vouchers.serial, cleanedSerials)));

  const found = new Map(rows.map(row => [row.serial, row]));
  const matchedIds: number[] = [];
  for (const serial of cleanedSerials) {
    const row = found.get(serial);
    if (row) matchedIds.push(row.id);
  }

  let affectedCount = 0;
  let status: "queued" | "running" | "done" | "failed" = "failed";

  if (matchedIds.length) {
    if (input.action === "group_change") {
      status = "failed";
    } else {
      const nextStatus = input.action === "stop" ? "expired" : "cancelled";
      await db.update(vouchers).set({ status: nextStatus, updatedAt: new Date() }).where(inArray(vouchers.id, matchedIds));
      affectedCount = matchedIds.length;
      status = "done";
    }
  }

  const insert = await db.insert(voucherBulkActions).values({
    organizationId: input.organizationId,
    actionType: input.action,
    voucherIds: JSON.stringify(matchedIds),
    targetGroupId: input.targetGroupId ?? null,
    status,
    affectedCount,
    createdByUserId: input.userId,
    completedAt: new Date(),
  });

  return {
    id: Number(insert[0]?.insertId),
    totalCards: cleanedSerials.length,
    affectedCards: affectedCount,
    failedCards: cleanedSerials.length - affectedCount,
  };
}

export async function listTenantSupportTicketsDetailed(organizationId: number, search?: string, status?: "open" | "pending" | "resolved" | "closed", options: { limit?: number; offset?: number } = {}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة التذاكر");
  const filters = [eq(supportTickets.organizationId, organizationId)] as Array<ReturnType<typeof sql>>;
  if (search?.trim()) {
    const needle = `%${search.trim()}%`;
    filters.push(or(like(supportTickets.subject, needle), like(supportTickets.reference, needle)) as ReturnType<typeof sql>);
  }
  if (status) filters.push(eq(supportTickets.status, status) as ReturnType<typeof sql>);
  return db.select({
    id: supportTickets.id,
    reference: supportTickets.reference,
    subject: supportTickets.subject,
    priority: supportTickets.priority,
    status: supportTickets.status,
    createdAt: supportTickets.createdAt,
    updatedAt: supportTickets.updatedAt,
    createdByName: users.name,
    deviceIpAddress: supportTicketDeviceInfo.ipAddress,
    deviceUserAgent: supportTicketDeviceInfo.userAgent,
    deviceMacAddress: supportTicketDeviceInfo.macAddress,
    routerId: supportTicketDeviceInfo.routerId,
    routerName: routers.name,
  }).from(supportTickets)
    .leftJoin(users, eq(supportTickets.createdByUserId, users.id))
    .leftJoin(supportTicketDeviceInfo, eq(supportTicketDeviceInfo.ticketId, supportTickets.id))
    .leftJoin(routers, eq(supportTicketDeviceInfo.routerId, routers.id))
    .where(and(...filters))
    .orderBy(desc(supportTickets.updatedAt))
    .limit(pageSize(options.limit ?? 25))
    .offset(pageOffset(options.offset ?? 0));
}

export async function createTenantSupportTicketDetailed(input: { organizationId: number; userId: number; subject: string; priority?: "low" | "normal" | "high" | "critical"; metadata?: { ipAddress?: string | null; userAgent?: string | null; routerId?: number | null; macAddress?: string | null } }) {
  const reference = `SUP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const ticket = await createTenantSupportTicket({
    organizationId: input.organizationId,
    userId: input.userId,
    reference,
    subject: input.subject,
    priority: input.priority ?? "normal",
  });
  const meta = input.metadata;
  if (!meta || (!meta.ipAddress && !meta.userAgent && !meta.routerId && !meta.macAddress)) return ticket;
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لحفظ بيانات الجهاز");
  await db.insert(supportTicketDeviceInfo).values({
    ticketId: ticket.id,
    ipAddress: meta.ipAddress?.trim() || null,
    userAgent: meta.userAgent?.trim() || null,
    routerId: meta.routerId ?? null,
    macAddress: meta.macAddress ? normalizeMacAddress(meta.macAddress) : null,
  }).onDuplicateKeyUpdate({ set: {
    ipAddress: meta.ipAddress?.trim() || null,
    userAgent: meta.userAgent?.trim() || null,
    routerId: meta.routerId ?? null,
    macAddress: meta.macAddress ? normalizeMacAddress(meta.macAddress) : null,
  } });
  return ticket;
}


export async function restoreTenantBackup(input: { organizationId: number; userId: number; backupJobId: number }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لاستعادة النسخة الاحتياطية");
  const job = await db.select({ id: backupJobs.id, status: backupJobs.status, fileId: backupJobs.fileId }).from(backupJobs)
    .where(and(eq(backupJobs.id, input.backupJobId), eq(backupJobs.organizationId, input.organizationId))).limit(1);
  if (!job[0]) throw new Error("النسخة الاحتياطية المطلوبة غير موجودة");
  if (!job[0].fileId) throw new Error("النسخة الاحتياطية لا تحتوي على ملف صالح للاستعادة");
  const fileRow = await db.select({ storageKey: files.storageKey }).from(files)
    .where(and(eq(files.id, job[0].fileId), eq(files.organizationId, input.organizationId))).limit(1);
  if (!fileRow[0]) throw new Error("ملف النسخة الاحتياطية غير موجود");
  await db.update(backupJobs).set({ status: "restoring", errorMessage: null }).where(eq(backupJobs.id, input.backupJobId));
  try {
    const { storageGet } = await import("./storage");
    const payloadRaw = await storageGet(fileRow[0].storageKey);
    const payloadText = Buffer.isBuffer(payloadRaw) ? payloadRaw.toString("utf8") : Buffer.from(payloadRaw).toString("utf8");
    const parsed = JSON.parse(payloadText) as Partial<Record<keyof typeof backupTables, unknown[]>>;
    await db.transaction(async tx => {
      for (const [key, table] of Object.entries(backupTables)) {
        await tx.delete(table as never).where(eq((table as typeof customers).organizationId, input.organizationId));
        const rows = Array.isArray(parsed[key as keyof typeof backupTables]) ? parsed[key as keyof typeof backupTables] as Record<string, unknown>[] : [];
        if (rows.length) {
          await tx.insert(table as never).values(rows.map(row => ({ ...row, organizationId: input.organizationId })) as never);
        }
      }
    });
    await db.update(backupJobs).set({ status: "restored", completedAt: new Date(), errorMessage: null }).where(eq(backupJobs.id, input.backupJobId));
    return { success: true } as const;
  } catch (error) {
    await db.update(backupJobs).set({ status: "failed", errorMessage: error instanceof Error ? error.message : "فشل الاستعادة" }).where(eq(backupJobs.id, input.backupJobId));
    throw error;
  }
}

export async function listPlatformInvoices(options: { limit?: number; offset?: number; search?: string } = {}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  const term = options.search?.trim();
  const conditions = term ? or(like(platformInvoices.number, `%${term}%`), like(organizations.name, `%${term}%`)) : undefined;
  return db.select({
    id: platformInvoices.id,
    number: platformInvoices.number,
    status: platformInvoices.status,
    total: platformInvoices.total,
    issuedAt: platformInvoices.issuedAt,
    dueAt: platformInvoices.dueAt,
    organizationName: organizations.name,
    organizationSlug: organizations.slug,
  }).from(platformInvoices).innerJoin(organizations, eq(platformInvoices.organizationId, organizations.id)).where(conditions).orderBy(desc(platformInvoices.createdAt)).limit(pageSize(options.limit ?? 25)).offset(pageOffset(options.offset ?? 0));
}

export async function listPlatformPayments(options: { limit?: number; offset?: number; search?: string } = {}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  const term = options.search?.trim();
  const conditions = term ? or(like(platformPayments.reference, `%${term}%`), like(platformInvoices.number, `%${term}%`)) : undefined;
  return db.select({
    id: platformPayments.id,
    amount: platformPayments.amount,
    method: platformPayments.method,
    status: platformPayments.status,
    reference: platformPayments.reference,
    invoiceNumber: platformInvoices.number,
    organizationName: organizations.name,
  }).from(platformPayments).innerJoin(organizations, eq(platformPayments.organizationId, organizations.id)).leftJoin(platformInvoices, eq(platformPayments.invoiceId, platformInvoices.id)).where(conditions).orderBy(desc(platformPayments.createdAt)).limit(pageSize(options.limit ?? 25)).offset(pageOffset(options.offset ?? 0));
}
