import { z } from "zod";
import {
  getTenantPointsSettings,
  saveTenantPointsSettings,
  listTenantPointsBenefitTiers,
  createTenantPointsBenefitTier,
  getTenantCustomerPointBalance,
  listTenantPointLedgerEntries,
  postTenantPointLedgerEntry,
} from "../db";
import { router, tenantPermissionProcedure } from "../_core/trpc";
import { auditMutation, moneyRegex, operationError, paginationInput, requestId } from "./_shared";

export const pointsRouter = router({
  settings: router({
    get: tenantPermissionProcedure("points:read").query(async ({ ctx }) => {
      try { return await getTenantPointsSettings(ctx.tenant.organizationId); }
      catch (error) { return operationError(error, "تعذر تحميل إعدادات النقاط الآن"); }
    }),
    save: tenantPermissionProcedure("points:write").input(z.object({ minimumAmount: z.string().regex(moneyRegex, "الحد الأدنى غير صالح"), isEnabled: z.boolean() })).mutation(async ({ ctx, input }) => {
      try {
        const result = await saveTenantPointsSettings({ ...input, organizationId: ctx.tenant.organizationId });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "points_settings.save", resourceType: "points_settings", requestId: requestId(ctx.req.headers), metadata: { isEnabled: input.isEnabled } });
        return result;
      } catch (error) { return operationError(error, "تعذر حفظ إعدادات النقاط الآن"); }
    }),
  }),
  tiers: router({
    list: tenantPermissionProcedure("points:read").query(async ({ ctx }) => {
      try { return await listTenantPointsBenefitTiers(ctx.tenant.organizationId); }
      catch (error) { return operationError(error, "تعذر تحميل مستويات المزايا الآن"); }
    }),
    create: tenantPermissionProcedure("points:write").input(z.object({ name: z.string().trim().min(2).max(120), requiredPoints: z.number().int().min(0).max(1_000_000), sortOrder: z.number().int().min(0).max(1000).optional() })).mutation(async ({ ctx, input }) => {
      try {
        const result = await createTenantPointsBenefitTier({ ...input, organizationId: ctx.tenant.organizationId });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "points_tier.create", resourceType: "points_benefit_tier", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { name: result.name } });
        return result;
      } catch (error) { return operationError(error, "تعذر إنشاء مستوى المزايا الآن"); }
    }),
  }),
  balances: router({
    get: tenantPermissionProcedure("points:read").input(z.object({ customerId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      try { return await getTenantCustomerPointBalance(ctx.tenant.organizationId, input.customerId); }
      catch (error) { return operationError(error, "تعذر تحميل رصيد النقاط الآن"); }
    }),
  }),
  ledger: router({
    list: tenantPermissionProcedure("points:read").input(z.object({ ...paginationInput, customerId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
      try { return await listTenantPointLedgerEntries(ctx.tenant.organizationId, input); }
      catch (error) { return operationError(error, "تعذر تحميل سجل حركة النقاط الآن"); }
    }),
    post: tenantPermissionProcedure("points:write").input(z.object({
      customerId: z.number().int().positive(),
      kind: z.enum(["earn", "redeem", "adjust"]),
      points: z.number().int().refine(value => value !== 0, "قيمة النقاط يجب أن تكون غير صفرية"),
      reason: z.string().trim().max(200).nullable().optional(),
    })).mutation(async ({ ctx, input }) => {
      try {
        const result = await postTenantPointLedgerEntry({ ...input, organizationId: ctx.tenant.organizationId, userId: ctx.user.id });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "point_ledger.post", resourceType: "point_ledger_entry", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { customerId: input.customerId, kind: input.kind, points: input.points } });
        return result;
      } catch (error) { return operationError(error, "تعذر تسجيل حركة النقاط الآن"); }
    }),
  }),
});
