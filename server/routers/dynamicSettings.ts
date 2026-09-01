import { z } from "zod";
import { listTenantDynamicSettingsItems, saveTenantDynamicSettingsItems } from "../db";
import { router, tenantPermissionProcedure } from "../_core/trpc";
import { auditMutation, operationError, requestId } from "./_shared";

const itemSchema = z.object({
  key: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(200),
  fieldType: z.enum(["select", "text", "checkbox", "time", "textarea", "number"]),
  expectedValues: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
  conditionField: z.string().trim().max(80).nullable().optional(),
  conditionOp: z.string().trim().max(8).nullable().optional(),
  conditionValue: z.string().trim().max(200).nullable().optional(),
  minValue: z.number().int().nullable().optional(),
  maxValue: z.number().int().nullable().optional(),
  notice: z.string().trim().max(400).nullable().optional(),
  sortOrder: z.union([z.number(), z.string()]).optional(),
  value: z.string().max(4000).nullable().optional(),
});

export const dynamicSettingsRouter = router({
  list: tenantPermissionProcedure("settings:dynamic:read").input(z.object({ module: z.string().trim().min(2).max(60) })).query(async ({ ctx, input }) => {
    try { return await listTenantDynamicSettingsItems({ organizationId: ctx.tenant.organizationId, module: input.module }); }
    catch (error) { return operationError(error, "تعذر تحميل الإعدادات الديناميكية الآن"); }
  }),
  save: tenantPermissionProcedure("settings:dynamic:write").input(z.object({ module: z.string().trim().min(2).max(60), items: z.array(itemSchema).min(1).max(100) })).mutation(async ({ ctx, input }) => {
    try {
      const result = await saveTenantDynamicSettingsItems({ organizationId: ctx.tenant.organizationId, userId: ctx.user.id, module: input.module, items: input.items });
      await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "dynamic_settings.save", resourceType: "dynamic_settings", resourceId: input.module, requestId: requestId(ctx.req.headers), metadata: { count: input.items.length } });
      return result;
    } catch (error) { return operationError(error, "تعذر حفظ الإعدادات الديناميكية الآن"); }
  }),
});
