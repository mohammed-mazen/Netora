import { z } from "zod";
import { createTenantCardImportJob, createTenantVoucherBulkAction, createTenantVoucherCategory, createTenantVoucherGroup, listTenantCardDesigns, listTenantCardImportJobs, listTenantPrintJobs, listTenantVoucherBulkActions, listTenantVoucherCategories, listTenantVoucherGroups, queueTenantPrintJob, saveTenantCardDesign } from "../db";
import { router, tenantPermissionProcedure } from "../_core/trpc";
import { auditMutation, moneyRegex, operationError, paginationInput, requestId } from "./_shared";

const priceEntry = z.object({ tier: z.enum(["retail", "wholesale", "wholesale_of_wholesale"]), price: z.string().regex(moneyRegex, "السعر غير صالح") });

export const cardsRouter = router({
  categories: router({
    list: tenantPermissionProcedure("cards:read").query(async ({ ctx }) => {
      try { return await listTenantVoucherCategories(ctx.tenant.organizationId); }
      catch (error) { return operationError(error, "تعذر تحميل فئات البطاقات الآن"); }
    }),
    create: tenantPermissionProcedure("cards:write").input(z.object({
      name: z.string().trim().min(2).max(120),
      priceType: z.enum(["fixed", "customer"]),
      amount: z.string().regex(moneyRegex, "المبلغ غير صالح"),
      prefix: z.string().trim().max(20).nullable().optional(),
      defaultAmount: z.string().regex(moneyRegex).nullable().optional(),
      maxAmount: z.string().regex(moneyRegex).nullable().optional(),
      minAmount: z.string().regex(moneyRegex).nullable().optional(),
      prices: z.array(priceEntry).max(3).optional(),
    })).mutation(async ({ ctx, input }) => {
      try {
        const result = await createTenantVoucherCategory({ ...input, organizationId: ctx.tenant.organizationId });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "voucher_category.create", resourceType: "voucher_category", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { name: result.name } });
        return result;
      } catch (error) { return operationError(error, "تعذر إنشاء فئة البطاقات الآن"); }
    }),
  }),
  groups: router({
    list: tenantPermissionProcedure("cards:read").query(async ({ ctx }) => {
      try { return await listTenantVoucherGroups(ctx.tenant.organizationId); }
      catch (error) { return operationError(error, "تعذر تحميل مجموعات البطاقات الآن"); }
    }),
    create: tenantPermissionProcedure("cards:write").input(z.object({
      name: z.string().trim().min(2).max(120),
      categoryId: z.number().int().positive().nullable().optional(),
      limitUsers: z.number().int().positive().max(1000).optional(),
      voucherCodeLength: z.number().int().min(4).max(32).optional(),
      timeBalanceMinutes: z.number().int().positive().nullable().optional(),
      downloadBalanceMb: z.number().int().positive().nullable().optional(),
      cardValidityDays: z.number().int().positive().nullable().optional(),
      speedProfileId: z.number().int().positive().nullable().optional(),
      mikrotikProfile: z.string().trim().max(120).nullable().optional(),
      linkWithFirstMac: z.boolean().optional(),
    })).mutation(async ({ ctx, input }) => {
      try {
        const result = await createTenantVoucherGroup({ ...input, organizationId: ctx.tenant.organizationId });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "voucher_group.create", resourceType: "voucher_group", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { name: result.name } });
        return result;
      } catch (error) { return operationError(error, "تعذر إنشاء مجموعة البطاقات الآن"); }
    }),
  }),
  designs: router({
    list: tenantPermissionProcedure("cardDesign:read").query(async ({ ctx }) => {
      try { return await listTenantCardDesigns(ctx.tenant.organizationId); }
      catch (error) { return operationError(error, "تعذر تحميل تصاميم البطاقات الآن"); }
    }),
    save: tenantPermissionProcedure("cardDesign:write").input(z.object({
      designId: z.number().int().positive().nullable().optional(),
      name: z.string().trim().min(2).max(120),
      isDefault: z.boolean().optional(),
      cardWidthMm: z.string().max(20).optional(),
      cardHeightMm: z.string().max(20).optional(),
      cardBorderColor: z.string().trim().max(20).optional(),
      backgroundImageKey: z.string().trim().max(500).nullable().optional(),
      watermarkOpacity: z.number().min(0).max(100).optional(),
      watermarkPosition: z.enum(["center", "top", "bottom"]).optional(),
      printSerialAsBarcode: z.boolean().optional(),
      printCardQrCode: z.boolean().optional(),
      fields: z.unknown(),
    })).mutation(async ({ ctx, input }) => {
      try {
        const result = await saveTenantCardDesign({ ...input, organizationId: ctx.tenant.organizationId, userId: ctx.user.id });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "card_design.save", resourceType: "card_design", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { name: result.name } });
        return result;
      } catch (error) { return operationError(error, "تعذر حفظ تصميم البطاقة الآن"); }
    }),
  }),
  printJobs: router({
    list: tenantPermissionProcedure("cardDesign:read").input(z.object(paginationInput)).query(async ({ ctx, input }) => {
      try { return await listTenantPrintJobs(ctx.tenant.organizationId, input); }
      catch (error) { return operationError(error, "تعذر تحميل قائمة الطباعة الآن"); }
    }),
    queue: tenantPermissionProcedure("cardDesign:write").input(z.object({ batchId: z.number().int().positive(), designId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try {
        const result = await queueTenantPrintJob({ ...input, organizationId: ctx.tenant.organizationId, userId: ctx.user.id });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "print_job.queue", resourceType: "print_job", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { batchId: input.batchId, designId: input.designId } });
        return result;
      } catch (error) { return operationError(error, "تعذر إضافة مهمة الطباعة الآن"); }
    }),
  }),
  bulk: router({
    list: tenantPermissionProcedure("cards:read").input(z.object(paginationInput)).query(async ({ ctx, input }) => {
      try { return await listTenantVoucherBulkActions(ctx.tenant.organizationId, input); }
      catch (error) { return operationError(error, "تعذر تحميل سجل العمليات المجمعة الآن"); }
    }),
    create: tenantPermissionProcedure("cards:write").input(z.object({ action: z.enum(["delete", "group_change", "stop"]), serials: z.array(z.string().trim().min(2).max(80)).min(1).max(1000), targetGroupId: z.number().int().positive().nullable().optional() })).mutation(async ({ ctx, input }) => {
      try {
        const result = await createTenantVoucherBulkAction({ organizationId: ctx.tenant.organizationId, userId: ctx.user.id, action: input.action, serials: input.serials, targetGroupId: input.targetGroupId ?? null });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "voucher_bulk.create", resourceType: "voucher_bulk_action", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { action: input.action, totalCards: result.totalCards, affectedCards: result.affectedCards, failedCards: result.failedCards } });
        return result;
      } catch (error) { return operationError(error, "تعذر تنفيذ العملية المجمعة الآن"); }
    }),
  }),
  imports: router({
    list: tenantPermissionProcedure("cards:import").input(z.object(paginationInput)).query(async ({ ctx, input }) => {
      try { return await listTenantCardImportJobs(ctx.tenant.organizationId, input); }
      catch (error) { return operationError(error, "تعذر تحميل مهام استيراد البطاقات الآن"); }
    }),
    create: tenantPermissionProcedure("cards:import").input(z.object({ source: z.enum(["csv", "mikrotik_sqlite", "mikrotik_wizard"]), content: z.string().max(1_000_000).nullable().optional(), fileId: z.number().int().positive().nullable().optional(), servicePlanId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try {
        const result = await createTenantCardImportJob({ organizationId: ctx.tenant.organizationId, userId: ctx.user.id, ...input });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "card_import.create", resourceType: "card_import_job", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { source: input.source, totalRows: result.totalRows } });
        return result;
      } catch (error) { return operationError(error, "تعذر إنشاء مهمة استيراد البطاقات الآن"); }
    }),
  }),
});
