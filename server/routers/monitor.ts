import { z } from "zod";
import {
  getTenantMonitorSettings,
  saveTenantMonitorSettings,
  listTenantMonitorSamples,
  recordTenantMonitorSample,
  recordTenantMonitorAction,
  listTenantMonitorActionLogs,
} from "../db";
import { resolveMonitorActionCapability } from "../monitorActions";
import { router, tenantPermissionProcedure } from "../_core/trpc";
import { auditMutation, operationError, paginationInput, requestId } from "./_shared";

export const monitorRouter = router({
  settings: router({
    get: tenantPermissionProcedure("monitor:read").query(async ({ ctx }) => {
      try { return await getTenantMonitorSettings(ctx.tenant.organizationId); }
      catch (error) { return operationError(error, "تعذر تحميل إعدادات المراقبة الآن"); }
    }),
    save: tenantPermissionProcedure("monitor:write").input(z.object({
      rebootable: z.boolean(),
      shutdownable: z.boolean(),
      batteryNotification: z.boolean(),
      batteryNotificationType: z.enum(["telegram", "sms", "email"]),
      batteryWarningPercentage: z.number().int().min(0).max(100),
      batteryCriticalPercentage: z.number().int().min(0).max(100),
      telegramChatId: z.string().trim().max(64).nullable().optional(),
    })).mutation(async ({ ctx, input }) => {
      try {
        const result = await saveTenantMonitorSettings({ ...input, organizationId: ctx.tenant.organizationId });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "monitor_settings.save", resourceType: "monitor_settings", requestId: requestId(ctx.req.headers), metadata: { batteryNotification: input.batteryNotification } });
        return result;
      } catch (error) { return operationError(error, "تعذر حفظ إعدادات المراقبة الآن"); }
    }),
  }),
  samples: router({
    list: tenantPermissionProcedure("monitor:read").input(z.object({ limit: z.number().int().min(1).max(200).default(50) })).query(async ({ ctx, input }) => {
      try { return await listTenantMonitorSamples(ctx.tenant.organizationId, input); }
      catch (error) { return operationError(error, "تعذر تحميل قراءات المراقبة الآن"); }
    }),
    // Called by the (optional) external monitoring agent script deployed
    // alongside the router/VPS being watched — not by the web UI. No audit
    // event is recorded here since this is a high-frequency telemetry
    // ingest endpoint, not an operator action.
    record: tenantPermissionProcedure("monitor:write").input(z.object({
      cpuPercent: z.number().min(0).max(100).nullable().optional(),
      memoryPercent: z.number().min(0).max(100).nullable().optional(),
      diskPercent: z.number().min(0).max(100).nullable().optional(),
      batteryPercent: z.number().min(0).max(100).nullable().optional(),
      serviceStatus: z.enum(["healthy", "degraded", "down"]).optional(),
    })).mutation(async ({ ctx, input }) => {
      try { return await recordTenantMonitorSample({ ...input, organizationId: ctx.tenant.organizationId }); }
      catch (error) { return operationError(error, "تعذر تسجيل قراءة المراقبة الآن"); }
    }),
  }),
  action: tenantPermissionProcedure("monitor:action").input(z.object({ routerId: z.number().int().positive(), action: z.enum(["reboot", "shutdown"]) })).mutation(async ({ ctx, input }) => {
    try {
      const settings = await getTenantMonitorSettings(ctx.tenant.organizationId);
      const capability = resolveMonitorActionCapability(input.action, { rebootable: Boolean(settings.rebootable), shutdownable: Boolean(settings.shutdownable) });
      if (!capability.ok) throw new Error(capability.error ?? "الإجراء غير مسموح");
      const result = await recordTenantMonitorAction({ organizationId: ctx.tenant.organizationId, userId: ctx.user.id, routerId: input.routerId, action: input.action });
      await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "monitor_action.queue", resourceType: "monitor_action_log", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { routerId: input.routerId, action: input.action } });
      return result;
    } catch (error) { return operationError(error, "تعذر جدولة إجراء المراقبة الآن"); }
  }),
  actions: router({
    list: tenantPermissionProcedure("monitor:read").input(z.object(paginationInput)).query(async ({ ctx, input }) => {
      try { return await listTenantMonitorActionLogs(ctx.tenant.organizationId, input); }
      catch (error) { return operationError(error, "تعذر تحميل سجل إجراءات المراقبة الآن"); }
    }),
  }),
});
