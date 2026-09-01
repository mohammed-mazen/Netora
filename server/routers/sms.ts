import { z } from "zod";
import { getTenantSmsSettings, listTenantSmsMessages, listTenantSmsTemplates, queueTenantSmsMessage, renderTenantSmsTemplate, saveTenantSmsSettings, saveTenantSmsTemplate } from "../db";
import { router, tenantPermissionProcedure } from "../_core/trpc";
import { auditMutation, operationError, paginationInput, requestId } from "./_shared";

export const smsRouter = router({
  settings: router({
    get: tenantPermissionProcedure("sms:read").query(async ({ ctx }) => {
      try { return await getTenantSmsSettings(ctx.tenant.organizationId); }
      catch (error) { return operationError(error, "تعذر تحميل إعدادات الرسائل الآن"); }
    }),
    save: tenantPermissionProcedure("sms:write").input(z.object({
      serverType: z.enum(["cloud", "local_modem"]),
      simCardsCount: z.enum(["one", "two"]),
      defaultSimCard: z.number().int().min(1).max(2),
      sendingType: z.enum(["auto", "manual"]),
      secretValue: z.string().trim().min(1).max(500).nullable().optional(),
    })).mutation(async ({ ctx, input }) => {
      try {
        const result = await saveTenantSmsSettings({ organizationId: ctx.tenant.organizationId, ...input });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "sms_settings.save", resourceType: "sms_settings", requestId: requestId(ctx.req.headers), metadata: { serverType: input.serverType, secretConfigured: Boolean(input.secretValue) } });
        return result;
      } catch (error) { return operationError(error, "تعذر حفظ إعدادات الرسائل الآن"); }
    }),
  }),
  messages: router({
    list: tenantPermissionProcedure("sms:read").input(z.object(paginationInput)).query(async ({ ctx, input }) => {
      try { return await listTenantSmsMessages(ctx.tenant.organizationId, input); }
      catch (error) { return operationError(error, "تعذر تحميل سجل الرسائل الآن"); }
    }),
    queue: tenantPermissionProcedure("sms:write").input(z.object({ customerId: z.number().int().positive().nullable().optional(), toNumber: z.string().trim().min(3).max(40), body: z.string().trim().min(1).max(640) })).mutation(async ({ ctx, input }) => {
      try {
        const result = await queueTenantSmsMessage({ organizationId: ctx.tenant.organizationId, userId: ctx.user.id, ...input });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "sms_message.queue", resourceType: "sms_message", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { toNumber: input.toNumber } });
        return result;
      } catch (error) { return operationError(error, "تعذر إرسال الرسالة الآن"); }
    }),
  }),
  templates: router({
    list: tenantPermissionProcedure("sms:templates").query(async ({ ctx }) => {
      try { return await listTenantSmsTemplates(ctx.tenant.organizationId); }
      catch (error) { return operationError(error, "تعذر تحميل قوالب الرسائل الآن"); }
    }),
    save: tenantPermissionProcedure("sms:templates").input(z.object({ templateId: z.number().int().positive().nullable().optional(), key: z.string().trim().min(2).max(80), name: z.string().trim().min(2).max(140), namespace: z.enum(["direct", "scheduled", "custom"]), body: z.string().trim().min(1).max(4000) })).mutation(async ({ ctx, input }) => {
      try {
        const result = await saveTenantSmsTemplate({ organizationId: ctx.tenant.organizationId, userId: ctx.user.id, ...input });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "sms_template.save", resourceType: "sms_template", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { key: input.key, namespace: input.namespace } });
        return result;
      } catch (error) { return operationError(error, "تعذر حفظ قالب الرسالة الآن"); }
    }),
    preview: tenantPermissionProcedure("sms:templates").input(z.object({ templateId: z.number().int().positive(), variables: z.record(z.string(), z.unknown()) })).mutation(async ({ ctx, input }) => {
      try { return await renderTenantSmsTemplate({ organizationId: ctx.tenant.organizationId, ...input }); }
      catch (error) { return operationError(error, "تعذر معاينة قالب الرسالة الآن"); }
    }),
  }),
});
