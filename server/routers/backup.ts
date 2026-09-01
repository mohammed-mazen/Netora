import { z } from "zod";
import { createTenantBackupJob, getTenantBackupSchedule, listTenantBackupJobs, restoreTenantBackup, runDueTenantBackupSchedule, saveTenantBackupSchedule } from "../db";
import { router, tenantPermissionProcedure } from "../_core/trpc";
import { auditMutation, operationError, paginationInput, requestId } from "./_shared";

export const backupRouter = router({
  list: tenantPermissionProcedure("backup:read").input(z.object(paginationInput)).query(async ({ ctx, input }) => {
    try {
      await runDueTenantBackupSchedule(ctx.tenant.organizationId, ctx.user.id);
      return await listTenantBackupJobs(ctx.tenant.organizationId, input);
    } catch (error) { return operationError(error, "تعذر تحميل النسخ الاحتياطية الآن"); }
  }),
  create: tenantPermissionProcedure("backup:write").input(z.object({ method: z.enum(["json", "mysqldump"]).optional() })).mutation(async ({ ctx, input }) => {
    try {
      const result = await createTenantBackupJob({ organizationId: ctx.tenant.organizationId, userId: ctx.user.id, method: input.method ?? "json" });
      await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "backup_job.create", resourceType: "backup_job", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { sizeBytes: result.sizeBytes, method: result.method } });
      return result;
    } catch (error) { return operationError(error, "تعذر إنشاء النسخة الاحتياطية الآن"); }
  }),
  restore: tenantPermissionProcedure("backup:write").input(z.object({ backupJobId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    try {
      const result = await restoreTenantBackup({ organizationId: ctx.tenant.organizationId, userId: ctx.user.id, backupJobId: input.backupJobId });
      await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "backup_job.restore", resourceType: "backup_job", resourceId: String(input.backupJobId), requestId: requestId(ctx.req.headers), metadata: { restored: true } });
      return result;
    } catch (error) { return operationError(error, "تعذر استعادة النسخة الاحتياطية الآن"); }
  }),
  schedule: router({
    get: tenantPermissionProcedure("backup:schedule").query(async ({ ctx }) => {
      try { return await getTenantBackupSchedule(ctx.tenant.organizationId); }
      catch (error) { return operationError(error, "تعذر تحميل جدولة النسخ الاحتياطية الآن"); }
    }),
    save: tenantPermissionProcedure("backup:schedule").input(z.object({ frequency: z.enum(["every_6h", "every_12h", "daily", "weekly"]), retentionDays: z.number().int().min(1).max(3650), isEnabled: z.boolean() })).mutation(async ({ ctx, input }) => {
      try {
        const result = await saveTenantBackupSchedule({ organizationId: ctx.tenant.organizationId, ...input });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "backup_schedule.save", resourceType: "backup_schedule", resourceId: String(ctx.tenant.organizationId), requestId: requestId(ctx.req.headers), metadata: { frequency: input.frequency, retentionDays: input.retentionDays, isEnabled: input.isEnabled } });
        return result;
      } catch (error) { return operationError(error, "تعذر حفظ جدولة النسخ الاحتياطية الآن"); }
    }),
  }),
});
