import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createTenantCustomer,
  assignTenantCustomerServicePlan,
  updateTenantCustomerStatus,
  enqueueTenantSessionDisconnect,
  enqueueTenantIntegrationJob,
  createTenantInvoice,
  createTenantRouter,
  updateTenantRouterCredential,
  updateTenantRouterNasIdentifier,
  createTenantServicePlan,
  activateTenantServicePlan,
  createTenantSite,
  createTenantSpeedProfile,
  createTenantSupportTicketDetailed,
  updateTenantSupportTicketStatus,
  createTenantSupportMessage,
  createTenantSupportTemplate,
  listTenantCustomers,
  listTenantInvoices,
  listTenantPayments,
  listTenantIntegrations,
  listTenantAuditLogs,
  getTenantReportSummary,
  listTenantJournalEntries,
  listTenantRouters,
  listTenantServicePlans,
  listTenantSites,
  listTenantSpeedProfiles,
  listTenantSessions,
  listTenantSupportTicketsDetailed,
  listTenantSupportMessages,
  listTenantSupportTemplates,
  listTenantAlertRules,
  listTenantVoucherBatches,
  listTenantVouchers,
  markTenantVoucherBatchPrinted,
  issueTenantInvoice,
  recordTenantPayment,
  recordTenantPaymentRefund,
  recordAuditEvent,
  saveTenantIntegrationDraft,
  saveTenantAlertRule,
  createTenantVoucherBatch,
} from "../db";
import { getTenantFileAccessUrl, listTenantFiles, uploadTenantFile } from "../fileService";
import { createSafeJobPayload, validateIntegrationDraft } from "../integrationContracts";
import { parseCustomerCsv } from "../customerImport";
import { setIntegrationSecret, setRouterCredential } from "../secrets";
import { router, tenantPermissionProcedure } from "../_core/trpc";

const paginationInput = {
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().min(0).default(0),
};
const voucherBatchListInput = { ...paginationInput, search: z.string().trim().max(80).optional(), status: z.enum(["draft", "generated", "printed", "cancelled"]).optional() };
const sessionListInput = { ...paginationInput, search: z.string().trim().max(120).optional(), state: z.enum(["active", "closed", "unknown"]).optional() };
const invoiceListInput = { ...paginationInput, search: z.string().trim().max(120).optional(), status: z.enum(["draft", "issued", "paid", "void", "overdue"]).optional() };

function requestId(headers: Record<string, string | string[] | undefined>) {
  const value = headers["x-request-id"];
  return (Array.isArray(value) ? value[0] : value)?.slice(0, 100) || crypto.randomUUID();
}

function operationError(error: unknown, fallback: string): never {
  const message = error instanceof Error ? error.message : fallback;
  if (/duplicate|unique/i.test(message)) throw new TRPCError({ code: "CONFLICT", message: "يوجد سجل مطابق بالفعل في هذه المؤسسة" });
  if (/لا يتبع للمؤسسة/i.test(message)) throw new TRPCError({ code: "BAD_REQUEST", message });
  console.error("[Workspace] Operation failed", error);
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: fallback });
}

async function auditMutation(input: {
  organizationId: number; actorUserId: number; action: string; resourceType: string; resourceId?: string; requestId: string; metadata?: Record<string, unknown>;
}) {
  await recordAuditEvent({ ...input, outcome: "success" });
}

export const workspaceRouter = router({
  network: router({
    listSites: tenantPermissionProcedure("network:read").input(z.object({ ...paginationInput, search: z.string().trim().max(120).optional() })).query(async ({ ctx, input }) => {
      try { return await listTenantSites(ctx.tenant.organizationId, input); }
      catch (error) { return operationError(error, "تعذر تحميل المواقع الآن"); }
    }),
    createSite: tenantPermissionProcedure("network:write").input(z.object({ name: z.string().trim().min(2).max(140), city: z.string().trim().max(80).nullable().optional() })).mutation(async ({ ctx, input }) => {
      try {
        const result = await createTenantSite({ ...input, organizationId: ctx.tenant.organizationId });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "site.create", resourceType: "site", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { city: input.city ?? null } });
        return result;
      } catch (error) { return operationError(error, "تعذر حفظ الموقع الآن"); }
    }),
    listSpeedProfiles: tenantPermissionProcedure("network:read").input(z.object({ ...paginationInput, search: z.string().trim().max(120).optional() })).query(async ({ ctx, input }) => {
      try { return await listTenantSpeedProfiles(ctx.tenant.organizationId, input); }
      catch (error) { return operationError(error, "تعذر تحميل ملفات السرعة الآن"); }
    }),
    createSpeedProfile: tenantPermissionProcedure("network:write").input(z.object({ name: z.string().trim().min(2).max(120), downloadKbps: z.number().int().min(1).max(10_000_000), uploadKbps: z.number().int().min(1).max(10_000_000) })).mutation(async ({ ctx, input }) => {
      try {
        const result = await createTenantSpeedProfile({ ...input, organizationId: ctx.tenant.organizationId });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "speed_profile.create", resourceType: "speed_profile", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { downloadKbps: input.downloadKbps, uploadKbps: input.uploadKbps } });
        return result;
      } catch (error) { return operationError(error, "تعذر حفظ ملف السرعة الآن"); }
    }),
    listRouters: tenantPermissionProcedure("network:read").input(z.object({ ...paginationInput, search: z.string().trim().max(120).optional(), status: z.enum(["pending", "healthy", "degraded", "offline", "disabled"]).optional() })).query(async ({ ctx, input }) => {
      try { return await listTenantRouters(ctx.tenant.organizationId, input); }
      catch (error) { return operationError(error, "تعذر تحميل الراوترات الآن"); }
    }),
    createRouter: tenantPermissionProcedure("network:write").input(z.object({
      name: z.string().trim().min(2).max(140),
      managementAddress: z.string().trim().min(3).max(255).regex(/^[a-zA-Z0-9._:[\]-]+$/, "عنوان الإدارة يجب أن يكون اسم مضيف أو عنوان IP صالحًا"),
      connectionMode: z.enum(["api_ssl", "rest_https", "agent"]).default("api_ssl"),
      siteId: z.number().int().positive().nullable().optional(),
      nasIdentifier: z.string().trim().max(160).nullable().optional(),
      username: z.string().trim().min(1).max(160).nullable().optional(),
      password: z.string().min(1).max(200).nullable().optional(),
    })).mutation(async ({ ctx, input }) => {
      try {
        const { username, password, ...routerInput } = input;
        const result = await createTenantRouter({ ...routerInput, organizationId: ctx.tenant.organizationId });
        // Credentials require the router's id (they are stored keyed by
        // routerId), so they are saved in a second step right after creation.
        if (username && password) {
          const credentialRef = await setRouterCredential(result.id, { username, password });
          await updateTenantRouterCredential({ organizationId: ctx.tenant.organizationId, routerId: result.id, credentialRef });
        }
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "router.create", resourceType: "router", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { connectionMode: input.connectionMode, siteId: input.siteId ?? null, credentialConfigured: Boolean(username && password) } });
        return result;
      } catch (error) { return operationError(error, "تعذر حفظ الراوتر الآن"); }
    }),
    // Exposes db.ts's updateTenantRouterNasIdentifier (previously written
    // but never wired to a procedure — see README "الخطوات التالية
    // الموصى بها" #12). NAS-Identifier can only be set once at creation
    // before this; operators who mistype it or need to reassign a router
    // to a different NAS entry had no way to fix it without direct DB
    // access. Enforces the same platform-wide uniqueness constraint as
    // creation (server/db.ts throws a friendly error on collision).
    updateRouterNasIdentifier: tenantPermissionProcedure("network:write").input(z.object({
      routerId: z.number().int().positive(),
      nasIdentifier: z.string().trim().max(160).nullable(),
    })).mutation(async ({ ctx, input }) => {
      try {
        await updateTenantRouterNasIdentifier({ organizationId: ctx.tenant.organizationId, routerId: input.routerId, nasIdentifier: input.nasIdentifier || null });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "router.nas_identifier_update", resourceType: "router", resourceId: String(input.routerId), requestId: requestId(ctx.req.headers), metadata: { nasIdentifier: input.nasIdentifier ?? null } });
        return { success: true } as const;
      } catch (error) { return operationError(error, "تعذر تحديث معرّف NAS للراوتر الآن"); }
    }),
  }),
  customers: router({
    list: tenantPermissionProcedure("customers:read").input(z.object({ ...paginationInput, search: z.string().trim().max(120).optional(), status: z.enum(["active", "suspended", "blocked", "archived"]).optional() })).query(async ({ ctx, input }) => {
      try { return await listTenantCustomers(ctx.tenant.organizationId, input.search, input.status, input.limit, input.offset); }
      catch (error) { return operationError(error, "تعذر تحميل العملاء الآن"); }
    }),
    create: tenantPermissionProcedure("customers:write").input(z.object({
      fullName: z.string().trim().min(2).max(160), username: z.string().trim().min(3).max(120),
      phone: z.string().trim().min(3).max(40).nullable().optional(), email: z.string().trim().email().max(320).nullable().optional(),
    })).mutation(async ({ ctx, input }) => {
      try {
        const result = await createTenantCustomer({ ...input, organizationId: ctx.tenant.organizationId });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "customer.create", resourceType: "customer", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { username: result.username } });
        return result;
      } catch (error) { return operationError(error, "تعذر حفظ العميل الآن"); }
    }),
    updateStatus: tenantPermissionProcedure("customers:write").input(z.object({ customerId: z.number().int().positive(), status: z.enum(["active", "suspended", "blocked", "archived"]) })).mutation(async ({ ctx, input }) => {
      try {
        const result = await updateTenantCustomerStatus({ ...input, organizationId: ctx.tenant.organizationId });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "customer.status_update", resourceType: "customer", resourceId: String(input.customerId), requestId: requestId(ctx.req.headers), metadata: { status: result.status, changed: result.changed } });
        return result;
      } catch (error) { return operationError(error, "تعذر تحديث حالة العميل الآن"); }
    }),
    assignServicePlan: tenantPermissionProcedure("customers:write").input(z.object({ customerId: z.number().int().positive(), servicePlanId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try {
        const result = await assignTenantCustomerServicePlan({ ...input, organizationId: ctx.tenant.organizationId, createdByUserId: ctx.user.id });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "customer.service_plan_assign", resourceType: "customer_service_assignment", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { customerId: input.customerId, servicePlanId: input.servicePlanId } });
        return result;
      } catch (error) { return operationError(error, "تعذر إسناد الباقة للعميل الآن"); }
    }),
    importCsv: tenantPermissionProcedure("customers:write").input(z.object({ content: z.string().min(1).max(1_000_000) })).mutation(async ({ ctx, input }) => {
      try {
        const parsed = parseCustomerCsv(input.content); let created = 0; let rejected = parsed.rejected;
        for (const row of parsed.accepted) { try { await createTenantCustomer({ organizationId: ctx.tenant.organizationId, fullName: row.fullName, username: row.username }); created += 1; } catch { rejected += 1; } }
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "customer.import_csv", resourceType: "customer_import", requestId: requestId(ctx.req.headers), metadata: { created, rejected } });
        return { created, rejected };
      } catch (error) { return operationError(error, "تعذر استيراد ملف العملاء الآن"); }
    }),
  }),
  alerts: router({
    list: tenantPermissionProcedure("monitor:read").input(z.object({ ...paginationInput })).query(async ({ ctx }) => {
      try { return await listTenantAlertRules(ctx.tenant.organizationId); }
      catch (error) { return operationError(error, "تعذر تحميل قواعد التنبيه الآن"); }
    }),
    listRules: tenantPermissionProcedure("monitor:read").input(z.object({ ...paginationInput })).query(async ({ ctx }) => {
      try { return await listTenantAlertRules(ctx.tenant.organizationId); }
      catch (error) { return operationError(error, "تعذر تحميل قواعد التنبيه الآن"); }
    }),
    saveRule: tenantPermissionProcedure("monitor:write").input(z.object({
      id: z.number().int().positive().optional(),
      key: z.string().trim().min(2).max(120).optional(),
      routerId: z.number().int().positive().nullable().optional(),
      metric: z.enum(["cpu", "memory", "sessions", "offline"]).optional(),
      comparator: z.enum([">", "<", ">=", "<=", "="]).optional(),
      threshold: z.number().finite().min(0).max(1_000_000).optional(),
      severity: z.enum(["info", "warning", "critical"]).default("warning"),
      notifyVia: z.enum(["dashboard", "email", "sms"]).optional(),
      enabled: z.boolean().optional(),
      isEnabled: z.boolean().optional(),
    })).mutation(async ({ ctx, input }) => {
      try {
        const key = input.key?.trim() || (input.metric ? [input.metric, input.comparator ?? "=", input.threshold ?? 0].join(":") : undefined);
        if (!key) throw new Error("يجب تحديد مفتاح قاعدة التنبيه");
        const isEnabled = input.isEnabled ?? input.enabled ?? true;
        const result = await saveTenantAlertRule({
          organizationId: ctx.tenant.organizationId,
          userId: ctx.user.id,
          key,
          severity: input.severity,
          isEnabled,
        });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "alert_rule.save", resourceType: "alert_rule", resourceId: String(result.key), requestId: requestId(ctx.req.headers), metadata: { key, severity: input.severity, enabled: isEnabled, routerId: input.routerId ?? null, metric: input.metric ?? null, comparator: input.comparator ?? null, threshold: input.threshold ?? null, notifyVia: input.notifyVia ?? null } });
        return result;
      } catch (error) { return operationError(error, "تعذر حفظ قاعدة التنبيه الآن"); }
    }),
  }),

  servicePlans: router({
    list: tenantPermissionProcedure("network:read").input(z.object({ ...paginationInput, search: z.string().trim().max(120).optional(), status: z.enum(["draft", "active", "archived"]).optional() })).query(async ({ ctx, input }) => {
      try { return await listTenantServicePlans(ctx.tenant.organizationId, input); }
      catch (error) { return operationError(error, "تعذر تحميل الباقات الآن"); }
    }),
    create: tenantPermissionProcedure("network:write").input(z.object({
      name: z.string().trim().min(2).max(140), type: z.enum(["voucher", "subscription", "pppoe"]),
      price: z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/, "السعر يجب أن يكون رقمًا ماليًا صالحًا"),
      validityDays: z.number().int().positive().max(3650).nullable().optional(), quotaMb: z.number().int().positive().max(1_000_000_000).nullable().optional(),
      simultaneousSessions: z.number().int().min(1).max(100).default(1), speedProfileId: z.number().int().positive().nullable().optional(),
    })).mutation(async ({ ctx, input }) => {
      try {
        const result = await createTenantServicePlan({ ...input, organizationId: ctx.tenant.organizationId });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "service_plan.create", resourceType: "service_plan", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { type: input.type } });
        return result;
      } catch (error) { return operationError(error, "تعذر حفظ الباقة الآن"); }
    }),
    activate: tenantPermissionProcedure("network:write").input(z.object({ servicePlanId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try {
        const result = await activateTenantServicePlan({ organizationId: ctx.tenant.organizationId, servicePlanId: input.servicePlanId });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "service_plan.activate", resourceType: "service_plan", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { status: result.status } });
        return result;
      } catch (error) { return operationError(error, "تعذر تفعيل الباقة الآن"); }
    }),
  }),
  vouchers: router({
    list: tenantPermissionProcedure("vouchers:read").input(z.object(paginationInput)).query(async ({ ctx, input }) => {
      try { return await listTenantVouchers(ctx.tenant.organizationId, input.limit, input.offset); }
      catch (error) { return operationError(error, "تعذر تحميل البطاقات الآن"); }
    }),
    listBatches: tenantPermissionProcedure("vouchers:read").input(z.object(voucherBatchListInput)).query(async ({ ctx, input }) => {
      try { return await listTenantVoucherBatches(ctx.tenant.organizationId, input); }
      catch (error) { return operationError(error, "تعذر تحميل دفعات البطاقات الآن"); }
    }),
    issueBatch: tenantPermissionProcedure("vouchers:write").input(z.object({ servicePlanId: z.number().int().positive(), quantity: z.number().int().min(1).max(250) })).mutation(async ({ ctx, input }) => {
      try {
        const result = await createTenantVoucherBatch({ ...input, organizationId: ctx.tenant.organizationId, userId: ctx.user.id });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "voucher_batch.issue", resourceType: "voucher_batch", resourceId: String(result.batchId), requestId: requestId(ctx.req.headers), metadata: { reference: result.reference, quantity: result.quantity, servicePlanId: input.servicePlanId } });
        return result;
      } catch (error) { return operationError(error, "تعذر إصدار دفعة البطاقات الآن"); }
    }),
    markBatchPrinted: tenantPermissionProcedure("vouchers:write").input(z.object({ batchId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try {
        const result = await markTenantVoucherBatchPrinted({ organizationId: ctx.tenant.organizationId, batchId: input.batchId });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "voucher_batch.mark_printed", resourceType: "voucher_batch", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { reference: result.reference } });
        return result;
      } catch (error) { return operationError(error, "تعذر تسجيل حالة الطباعة الآن"); }
    }),
  }),
  sessions: router({
    list: tenantPermissionProcedure("network:read").input(z.object(sessionListInput)).query(async ({ ctx, input }) => {
      try { return await listTenantSessions(ctx.tenant.organizationId, input); }
      catch (error) { return operationError(error, "تعذر تحميل الجلسات الآن"); }
    }),
    queueDisconnect: tenantPermissionProcedure("sessions:control").input(z.object({ sessionId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try {
        const result = await enqueueTenantSessionDisconnect({ organizationId: ctx.tenant.organizationId, sessionId: input.sessionId });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "session.disconnect.queue", resourceType: "network_session", resourceId: String(input.sessionId), requestId: requestId(ctx.req.headers), metadata: { jobId: result.id } });
        return result;
      } catch (error) { return operationError(error, "تعذر إضافة طلب قطع الجلسة الآن"); }
    }),
  }),
  billing: router({
    listInvoices: tenantPermissionProcedure("billing:read").input(z.object(invoiceListInput)).query(async ({ ctx, input }) => {
      try { return await listTenantInvoices(ctx.tenant.organizationId, input); }
      catch (error) { return operationError(error, "تعذر تحميل الفواتير الآن"); }
    }),
    listPayments: tenantPermissionProcedure("billing:read").input(z.object({ ...paginationInput, search: z.string().trim().max(120).optional(), method: z.enum(["cash", "bank", "gateway", "credit"]).optional() })).query(async ({ ctx, input }) => {
      try { return await listTenantPayments(ctx.tenant.organizationId, input); }
      catch (error) { return operationError(error, "تعذر تحميل الدفعات الآن"); }
    }),
    createInvoice: tenantPermissionProcedure("billing:write").input(z.object({ customerId: z.number().int().positive().nullable().optional(), total: z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/, "إجمالي الفاتورة غير صالح"), dueAt: z.coerce.date().nullable().optional() })).mutation(async ({ ctx, input }) => {
      try {
        const result = await createTenantInvoice({ organizationId: ctx.tenant.organizationId, customerId: input.customerId ?? null, total: input.total, dueAt: input.dueAt ?? null });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "invoice.create", resourceType: "invoice", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { number: result.number, customerId: input.customerId ?? null, total: input.total } });
        return result;
      } catch (error) { return operationError(error, "تعذر إنشاء الفاتورة الآن"); }
    }),
    issueInvoice: tenantPermissionProcedure("billing:write").input(z.object({ invoiceId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try {
        const result = await issueTenantInvoice({ organizationId: ctx.tenant.organizationId, userId: ctx.user.id, invoiceId: input.invoiceId });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "invoice.issue", resourceType: "invoice", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { number: result.number } });
        return result;
      } catch (error) { return operationError(error, "تعذر إصدار الفاتورة الآن"); }
    }),
    recordPayment: tenantPermissionProcedure("billing:write").input(z.object({ invoiceId: z.number().int().positive(), amount: z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/, "قيمة الدفعة غير صالحة"), method: z.enum(["cash", "bank", "gateway", "credit"]), reference: z.string().trim().max(160).nullable().optional() })).mutation(async ({ ctx, input }) => {
      try {
        const result = await recordTenantPayment({ organizationId: ctx.tenant.organizationId, userId: ctx.user.id, invoiceId: input.invoiceId, amount: input.amount, method: input.method, reference: input.reference ?? null });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "payment.record", resourceType: "payment", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { invoiceId: input.invoiceId, amount: input.amount, method: input.method, reference: input.reference ?? null } });
        return result;
      } catch (error) { return operationError(error, "تعذر تسجيل الدفعة الآن"); }
    }),
    refundPayment: tenantPermissionProcedure("billing:write").input(z.object({ paymentId: z.number().int().positive(), note: z.string().trim().max(240).nullable().optional() })).mutation(async ({ ctx, input }) => {
      try {
        const result = await recordTenantPaymentRefund({ organizationId: ctx.tenant.organizationId, userId: ctx.user.id, paymentId: input.paymentId });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "payment.refund", resourceType: "payment", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { paymentId: input.paymentId, note: input.note ?? null } });
        return result;
      } catch (error) { return operationError(error, "تعذر تسجيل استرداد الدفعة الآن"); }
    }),

    journalEntries: tenantPermissionProcedure("billing:read").input(z.object({ ...paginationInput, search: z.string().trim().max(120).optional() })).query(async ({ ctx, input }) => {
      try { return await listTenantJournalEntries(ctx.tenant.organizationId, input); }
      catch (error) { return operationError(error, "تعذر تحميل القيود المحاسبية الآن"); }
    }),
  }),
  support: router({
    list: tenantPermissionProcedure("support:read").input(z.object({ ...paginationInput, search: z.string().trim().max(120).optional(), status: z.enum(["open", "pending", "resolved", "closed"]).optional() })).query(async ({ ctx, input }) => {
      try { return await listTenantSupportTicketsDetailed(ctx.tenant.organizationId, input.search, input.status, input); }
      catch (error) { return operationError(error, "تعذر تحميل التذاكر الآن"); }
    }),
    create: tenantPermissionProcedure("support:write").input(z.object({
      subject: z.string().trim().min(5).max(200),
      priority: z.enum(["low", "normal", "high", "critical"]).default("normal"),
      metadata: z.object({
        userAgent: z.string().trim().max(400).nullable().optional(),
        ipAddress: z.string().trim().max(64).nullable().optional(),
        macAddress: z.string().trim().max(17).nullable().optional(),
        routerId: z.number().int().positive().nullable().optional(),
      }).optional(),
    })).mutation(async ({ ctx, input }) => {
      try {
        const result = await createTenantSupportTicketDetailed({
          organizationId: ctx.tenant.organizationId,
          userId: ctx.user.id,
          subject: input.subject,
          priority: input.priority,
          metadata: {
            ...input.metadata,
            ipAddress: input.metadata?.ipAddress ?? ctx.req.ip ?? undefined,
            userAgent: input.metadata?.userAgent ?? (Array.isArray(ctx.req.headers["user-agent"]) ? ctx.req.headers["user-agent"][0] : ctx.req.headers["user-agent"]) ?? undefined,
          },
        });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "support_ticket.create", resourceType: "support_ticket", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { priority: input.priority, subject: input.subject, routerId: input.metadata?.routerId ?? null, macAddress: input.metadata?.macAddress ?? null } });
        return result;
      } catch (error) { return operationError(error, "تعذر فتح التذكرة الآن"); }
    }),
    updateStatus: tenantPermissionProcedure("support:write").input(z.object({ ticketId: z.number().int().positive(), status: z.enum(["open", "pending", "resolved", "closed"]) })).mutation(async ({ ctx, input }) => {
      try {
        const result = await updateTenantSupportTicketStatus({ ...input, organizationId: ctx.tenant.organizationId });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "support_ticket.status_update", resourceType: "support_ticket", resourceId: String(input.ticketId), requestId: requestId(ctx.req.headers), metadata: { status: result.status, changed: result.changed } });
        return result;
      } catch (error) { return operationError(error, "تعذر تحديث حالة التذكرة الآن"); }
    }),
    listMessages: tenantPermissionProcedure("support:read").input(z.object({ ticketId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      try { return await listTenantSupportMessages(ctx.tenant.organizationId, input.ticketId); }
      catch (error) { return operationError(error, "تعذر تحميل رسائل التذكرة الآن"); }
    }),
    addMessage: tenantPermissionProcedure("support:write").input(z.object({ ticketId: z.number().int().positive(), body: z.string().trim().min(2).max(4000) })).mutation(async ({ ctx, input }) => {
      try {
        const result = await createTenantSupportMessage({ organizationId: ctx.tenant.organizationId, userId: ctx.user.id, ticketId: input.ticketId, body: input.body });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "support_message.create", resourceType: "support_message", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { ticketId: input.ticketId } });
        return result;
      } catch (error) { return operationError(error, "تعذر إضافة الرسالة الآن"); }
    }),
    listTemplates: tenantPermissionProcedure("support:read").query(async ({ ctx }) => {
      try { return await listTenantSupportTemplates(ctx.tenant.organizationId); }
      catch (error) { return operationError(error, "تعذر تحميل قوالب الدعم الآن"); }
    }),
    createTemplate: tenantPermissionProcedure("support:write").input(z.object({ name: z.string().trim().min(2).max(120), body: z.string().trim().min(2).max(2000) })).mutation(async ({ ctx, input }) => {
      try {
        const result = await createTenantSupportTemplate({ organizationId: ctx.tenant.organizationId, userId: ctx.user.id, name: input.name, body: input.body });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "support_template.create", resourceType: "support_template", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { name: input.name } });
        return result;
      } catch (error) { return operationError(error, "تعذر حفظ قالب الدعم الآن"); }
    }),
  }),  integrations: router({
    list: tenantPermissionProcedure("network:read").query(async ({ ctx }) => {
      try { return await listTenantIntegrations(ctx.tenant.organizationId); }
      catch (error) { return operationError(error, "تعذر تحميل التكاملات الآن"); }
    }),
    saveDraft: tenantPermissionProcedure("network:write").input(z.object({
      kind: z.enum(["radius", "mikrotik"]),
      secretValue: z.string().trim().max(255).nullable().optional(),
      configuration: z.record(z.string(), z.unknown()),
    })).mutation(async ({ ctx, input }) => {
      try {
        const result = await saveTenantIntegrationDraft({ organizationId: ctx.tenant.organizationId, kind: input.kind, secretRef: input.secretValue ?? null, configuration: input.configuration });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "integration.save_draft", resourceType: "integration", resourceId: input.kind, requestId: requestId(ctx.req.headers), metadata: { kind: input.kind, secretConfigured: result.secretConfigured } });
        return result;
      } catch (error) { return operationError(error, "تعذر حفظ مسودة التكامل الآن"); }
    }),
    queueHealthCheck: tenantPermissionProcedure("network:write").input(z.object({ kind: z.enum(["radius", "mikrotik"]) })).mutation(async ({ ctx, input }) => {
      try {
        const type = input.kind === "mikrotik" ? "router_health_check" : "radius_health_check";
        const result = await enqueueTenantIntegrationJob({ organizationId: ctx.tenant.organizationId, kind: input.kind, type, payload: {} });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "integration.queue_health_check", resourceType: "integration", resourceId: input.kind, requestId: requestId(ctx.req.headers), metadata: { kind: input.kind, jobId: result.id } });
        return result;
      } catch (error) { return operationError(error, "تعذر إضافة فحص التكامل الآن"); }
    }),
  }),
  reports: router({
    summary: tenantPermissionProcedure("workspace:read").query(async ({ ctx }) => {
      try { return await getTenantReportSummary(ctx.tenant.organizationId); }
      catch (error) { return operationError(error, "تعذر تحميل ملخص التقارير الآن"); }
    }),
  }),

  audit: router({
    list: tenantPermissionProcedure("support:read").input(z.object({ ...paginationInput, search: z.string().trim().max(120).optional(), outcome: z.enum(["success", "denied", "failed"]).optional() })).query(async ({ ctx, input }) => {
      try { return await listTenantAuditLogs(ctx.tenant.organizationId, input); }
      catch (error) { return operationError(error, "تعذر تحميل سجل التدقيق الآن"); }
    }),
  }),

  files: router({
    list: tenantPermissionProcedure("files:read").input(z.object({ ...paginationInput, search: z.string().trim().max(120).optional(), category: z.enum(["import", "report", "backup", "attachment"]).optional() })).query(async ({ ctx, input }) => {
      try { return await listTenantFiles(ctx.tenant.organizationId, input); }
      catch (error) { return operationError(error, "تعذر تحميل ملفات المؤسسة الآن"); }
    }),
    upload: tenantPermissionProcedure("files:write").input(z.object({
      originalName: z.string().trim().min(1).max(255), mimeType: z.enum(["text/csv", "text/plain", "application/json", "application/pdf", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]),
      contentBase64: z.string().min(4).max(7_000_000), category: z.enum(["import", "report", "backup", "attachment"]),
    })).mutation(async ({ ctx, input }) => {
      try {
        const result = await uploadTenantFile({ ...input, organizationId: ctx.tenant.organizationId, userId: ctx.user.id });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "file.upload", resourceType: "file", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { category: result.category, mimeType: input.mimeType, sizeBytes: result.sizeBytes } });
        return result;
      } catch (error) { return operationError(error, "تعذر رفع الملف الآن"); }
    }),
    getAccessUrl: tenantPermissionProcedure("files:read").input(z.object({ fileId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try {
        const result = await getTenantFileAccessUrl({ organizationId: ctx.tenant.organizationId, fileId: input.fileId });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "file.access_url_issue", resourceType: "file", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { originalName: result.originalName } });
        return result;
      } catch (error) { return operationError(error, "تعذر إصدار رابط فتح الملف الآن"); }
    }),
  }),
});
