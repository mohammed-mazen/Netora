import { z } from "zod";
import {
  createTenantReportDefinition,
  createTenantReportSchedule,
  generateTenantReportExport,
  getTenantReportBuilderAccess,
  listTenantReportCategories,
  listTenantReportDefinitions,
  listTenantReportExports,
  listTenantReportParameterDefinitions,
  listTenantReportSavedFilters,
  listTenantReportScheduleDeliveries,
  listTenantReportScheduleLogs,
  listTenantReportSchedules,
  runDueTenantReportSchedules,
  saveTenantReportBuilderAccessPin,
  saveTenantReportCategory,
  saveTenantReportParameterDefinitions,
  saveTenantReportSavedFilter,
  saveTenantReportScheduleDeliveries,
  verifyTenantReportBuilderPin,
} from "../db";
import { router, tenantPermissionProcedure } from "../_core/trpc";
import { auditMutation, operationError, paginationInput, requestId } from "./_shared";

const datasetSchema = z.enum(["customers", "invoices", "payments", "vouchers", "sessions", "journal_entries", "support_tickets"]);
const parameterSchema = z.object({
  key: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(160),
  fieldType: z.enum(["text", "number", "date", "date_range", "select", "sort"]),
  expectedValues: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
  isRequired: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const reportBuilderRouter = router({
  access: router({
    get: tenantPermissionProcedure("reports:sqlEditor").query(async ({ ctx }) => {
      try { return await getTenantReportBuilderAccess(ctx.tenant.organizationId); }
      catch (error) { return operationError(error, "تعذر تحميل إعدادات الوصول المتقدم الآن"); }
    }),
    savePin: tenantPermissionProcedure("reports:sqlEditor").input(z.object({ pin: z.string().trim().length(4).nullable().optional() })).mutation(async ({ ctx, input }) => {
      try {
        const result = await saveTenantReportBuilderAccessPin({ organizationId: ctx.tenant.organizationId, pin: input.pin ?? null });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "report_builder.pin.save", resourceType: "report_builder_access", resourceId: String(ctx.tenant.organizationId), requestId: requestId(ctx.req.headers), metadata: { hasPin: result.hasPin } });
        return result;
      } catch (error) { return operationError(error, "تعذر حفظ PIN منشئ التقارير الآن"); }
    }),
    verifyPin: tenantPermissionProcedure("reports:sqlEditor").input(z.object({ pin: z.string().trim().length(4) })).mutation(async ({ ctx, input }) => {
      try { return await verifyTenantReportBuilderPin({ organizationId: ctx.tenant.organizationId, pin: input.pin }); }
      catch (error) { return operationError(error, "تعذر التحقق من PIN منشئ التقارير الآن"); }
    }),
  }),
  categories: router({
    list: tenantPermissionProcedure("reports:builder").query(async ({ ctx }) => {
      try { return await listTenantReportCategories(ctx.tenant.organizationId); }
      catch (error) { return operationError(error, "تعذر تحميل فئات التقارير الآن"); }
    }),
    save: tenantPermissionProcedure("reports:builder").input(z.object({ name: z.string().trim().min(2).max(120), sortOrder: z.number().int().optional() })).mutation(async ({ ctx, input }) => {
      try {
        const result = await saveTenantReportCategory({ organizationId: ctx.tenant.organizationId, ...input });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "report_category.save", resourceType: "report_category", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { name: result.name } });
        return result;
      } catch (error) { return operationError(error, "تعذر حفظ فئة التقرير الآن"); }
    }),
  }),
  definitions: router({
    list: tenantPermissionProcedure("reports:builder").query(async ({ ctx }) => {
      try { return await listTenantReportDefinitions(ctx.tenant.organizationId); }
      catch (error) { return operationError(error, "تعذر تحميل تعريفات التقارير الآن"); }
    }),
    create: tenantPermissionProcedure("reports:builder").input(z.object({
      name: z.string().trim().min(2).max(160),
      dataset: datasetSchema,
      columns: z.array(z.string().trim().min(1).max(60)).min(1).max(30),
      filters: z.record(z.string(), z.unknown()).nullable().optional(),
    })).mutation(async ({ ctx, input }) => {
      try {
        const result = await createTenantReportDefinition({ ...input, organizationId: ctx.tenant.organizationId, userId: ctx.user.id });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "report_definition.create", resourceType: "report_definition", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { name: result.name, dataset: input.dataset } });
        return result;
      } catch (error) { return operationError(error, "تعذر إنشاء تعريف التقرير الآن"); }
    }),
  }),
  parameters: router({
    list: tenantPermissionProcedure("reports:builder").input(z.object({ reportDefinitionId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      try { return await listTenantReportParameterDefinitions({ organizationId: ctx.tenant.organizationId, reportDefinitionId: input.reportDefinitionId }); }
      catch (error) { return operationError(error, "تعذر تحميل معلمات التقرير الآن"); }
    }),
    save: tenantPermissionProcedure("reports:builder").input(z.object({ reportDefinitionId: z.number().int().positive(), parameters: z.array(parameterSchema).max(50) })).mutation(async ({ ctx, input }) => {
      try {
        const result = await saveTenantReportParameterDefinitions({ organizationId: ctx.tenant.organizationId, reportDefinitionId: input.reportDefinitionId, parameters: input.parameters });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "report_parameters.save", resourceType: "report_definition", resourceId: String(input.reportDefinitionId), requestId: requestId(ctx.req.headers), metadata: { count: input.parameters.length } });
        return result;
      } catch (error) { return operationError(error, "تعذر حفظ معلمات التقرير الآن"); }
    }),
  }),
  filters: router({
    list: tenantPermissionProcedure("reports:builder").input(z.object({ reportDefinitionId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      try { return await listTenantReportSavedFilters({ organizationId: ctx.tenant.organizationId, reportDefinitionId: input.reportDefinitionId }); }
      catch (error) { return operationError(error, "تعذر تحميل الفلاتر المحفوظة الآن"); }
    }),
    save: tenantPermissionProcedure("reports:builder").input(z.object({ reportDefinitionId: z.number().int().positive(), name: z.string().trim().min(2).max(140), filterJson: z.record(z.string(), z.unknown()), isShared: z.boolean().optional() })).mutation(async ({ ctx, input }) => {
      try {
        const result = await saveTenantReportSavedFilter({ organizationId: ctx.tenant.organizationId, userId: ctx.user.id, ...input });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "report_filter.save", resourceType: "report_saved_filter", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { name: result.name } });
        return result;
      } catch (error) { return operationError(error, "تعذر حفظ الفلتر الآن"); }
    }),
  }),
  schedules: router({
    list: tenantPermissionProcedure("reports:schedules").query(async ({ ctx }) => {
      try {
        await runDueTenantReportSchedules(ctx.tenant.organizationId);
        return await listTenantReportSchedules(ctx.tenant.organizationId);
      } catch (error) { return operationError(error, "تعذر تحميل الجدولات الآن"); }
    }),
    create: tenantPermissionProcedure("reports:schedules").input(z.object({ reportDefinitionId: z.number().int().positive(), frequency: z.enum(["daily", "weekly", "monthly"]) })).mutation(async ({ ctx, input }) => {
      try {
        const result = await createTenantReportSchedule({ ...input, organizationId: ctx.tenant.organizationId });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "report_schedule.create", resourceType: "report_schedule", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { frequency: input.frequency } });
        return result;
      } catch (error) { return operationError(error, "تعذر إنشاء الجدولة الآن"); }
    }),
  }),
  deliveries: router({
    list: tenantPermissionProcedure("reports:schedules").input(z.object({ reportScheduleId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      try { return await listTenantReportScheduleDeliveries({ organizationId: ctx.tenant.organizationId, reportScheduleId: input.reportScheduleId }); }
      catch (error) { return operationError(error, "تعذر تحميل وجهات التسليم الآن"); }
    }),
    save: tenantPermissionProcedure("reports:schedules").input(z.object({ reportScheduleId: z.number().int().positive(), deliveries: z.array(z.object({ channel: z.enum(["email", "telegram"]), target: z.string().trim().min(3).max(255) })).max(20) })).mutation(async ({ ctx, input }) => {
      try {
        const result = await saveTenantReportScheduleDeliveries({ organizationId: ctx.tenant.organizationId, reportScheduleId: input.reportScheduleId, deliveries: input.deliveries });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "report_delivery.save", resourceType: "report_schedule", resourceId: String(input.reportScheduleId), requestId: requestId(ctx.req.headers), metadata: { count: input.deliveries.length } });
        return result;
      } catch (error) { return operationError(error, "تعذر حفظ وجهات التسليم الآن"); }
    }),
  }),
  logs: router({
    list: tenantPermissionProcedure("reports:schedules").input(z.object(paginationInput)).query(async ({ ctx, input }) => {
      try { return await listTenantReportScheduleLogs(ctx.tenant.organizationId, input); }
      catch (error) { return operationError(error, "تعذر تحميل سجل الجدولات الآن"); }
    }),
  }),
  exports: router({
    list: tenantPermissionProcedure("reports:builder").input(z.object(paginationInput)).query(async ({ ctx, input }) => {
      try { return await listTenantReportExports(ctx.tenant.organizationId, input); }
      catch (error) { return operationError(error, "تعذر تحميل تصديرات التقارير الآن"); }
    }),
    generate: tenantPermissionProcedure("reports:builder").input(z.object({ reportDefinitionId: z.number().int().positive(), format: z.enum(["csv", "excel", "pdf"]).optional() })).mutation(async ({ ctx, input }) => {
      try {
        const result = await generateTenantReportExport({ ...input, organizationId: ctx.tenant.organizationId, userId: ctx.user.id });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "report_export.generate", resourceType: "report_export", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { rowCount: result.rowCount, format: result.format } });
        return result;
      } catch (error) { return operationError(error, "تعذر توليد تصدير التقرير الآن"); }
    }),
  }),
});
