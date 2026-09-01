import { z } from "zod";
import { deleteTenantMacSecurityRule, listTenantMacSecurityActionLogs, listTenantMacSecurityRules, recordTenantMacSecurityAction, saveTenantMacSecurityRule } from "../db";
import { router, tenantPermissionProcedure } from "../_core/trpc";
import { auditMutation, operationError, paginationInput, requestId } from "./_shared";

export const macSecurityRouter = router({
  rules: router({
    list: tenantPermissionProcedure("macsec:read").query(async ({ ctx }) => {
      try { return await listTenantMacSecurityRules(ctx.tenant.organizationId); }
      catch (error) { return operationError(error, "تعذر تحميل قواعد MAC Security الآن"); }
    }),
    save: tenantPermissionProcedure("macsec:write").input(z.object({
      macAddress: z.string().trim().min(12).max(17),
      listType: z.enum(["whitelist", "blacklist"]),
      reason: z.string().trim().max(255).nullable().optional(),
      customerId: z.number().int().positive().nullable().optional(),
    })).mutation(async ({ ctx, input }) => {
      try {
        const result = await saveTenantMacSecurityRule({ organizationId: ctx.tenant.organizationId, userId: ctx.user.id, ...input });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "macsec.rule.save", resourceType: "macsec_rule", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { macAddress: result.macAddress, listType: result.listType } });
        return result;
      } catch (error) { return operationError(error, "تعذر حفظ قاعدة MAC Security الآن"); }
    }),
    delete: tenantPermissionProcedure("macsec:write").input(z.object({ ruleId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try {
        const result = await deleteTenantMacSecurityRule({ organizationId: ctx.tenant.organizationId, ruleId: input.ruleId });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "macsec.rule.delete", resourceType: "macsec_rule", resourceId: String(input.ruleId), requestId: requestId(ctx.req.headers) });
        return result;
      } catch (error) { return operationError(error, "تعذر حذف قاعدة MAC Security الآن"); }
    }),
  }),
  actions: router({
    list: tenantPermissionProcedure("macsec:read").input(z.object(paginationInput)).query(async ({ ctx, input }) => {
      try { return await listTenantMacSecurityActionLogs(ctx.tenant.organizationId, input); }
      catch (error) { return operationError(error, "تعذر تحميل سجل MAC Security الآن"); }
    }),
    record: tenantPermissionProcedure("macsec:action").input(z.object({ macAddress: z.string().trim().min(12).max(17), action: z.enum(["block", "unblock"]) })).mutation(async ({ ctx, input }) => {
      try {
        const result = await recordTenantMacSecurityAction({ organizationId: ctx.tenant.organizationId, userId: ctx.user.id, ...input });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: `macsec.${input.action}`, resourceType: "macsec_action_log", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { macAddress: result.macAddress } });
        return result;
      } catch (error) { return operationError(error, "تعذر تسجيل إجراء MAC Security الآن"); }
    }),
  }),
});
