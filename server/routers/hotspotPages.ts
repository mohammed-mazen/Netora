import { z } from "zod";
import { deleteTenantHotspotLoginPage, listTenantHotspotLoginPages, saveTenantHotspotLoginPage } from "../db";
import { router, tenantPermissionProcedure } from "../_core/trpc";
import { auditMutation, operationError, requestId } from "./_shared";

export const hotspotPagesRouter = router({
  list: tenantPermissionProcedure("hotspotPages:read").query(async ({ ctx }) => {
    try { return await listTenantHotspotLoginPages(ctx.tenant.organizationId); }
    catch (error) { return operationError(error, "تعذر تحميل صفحات الدخول الآن"); }
  }),
  save: tenantPermissionProcedure("hotspotPages:write").input(z.object({
    pageId: z.number().int().positive().nullable().optional(),
    name: z.string().trim().min(2).max(140),
    isDefault: z.boolean().optional(),
    logoImageKey: z.string().trim().max(600).nullable().optional(),
    backgroundImageKey: z.string().trim().max(600).nullable().optional(),
    primaryColor: z.string().trim().max(16).nullable().optional(),
    welcomeTitle: z.string().trim().max(200).nullable().optional(),
    welcomeBody: z.string().trim().max(4000).nullable().optional(),
    termsText: z.string().trim().max(4000).nullable().optional(),
    voucherGroupScope: z.array(z.number().int().positive()).max(100).optional(),
  })).mutation(async ({ ctx, input }) => {
    try {
      const result = await saveTenantHotspotLoginPage({ organizationId: ctx.tenant.organizationId, userId: ctx.user.id, ...input });
      await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "hotspot_page.save", resourceType: "hotspot_login_page", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { name: result.name } });
      return result;
    } catch (error) { return operationError(error, "تعذر حفظ صفحة الدخول الآن"); }
  }),
  delete: tenantPermissionProcedure("hotspotPages:write").input(z.object({ pageId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    try {
      const result = await deleteTenantHotspotLoginPage({ organizationId: ctx.tenant.organizationId, pageId: input.pageId });
      await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "hotspot_page.delete", resourceType: "hotspot_login_page", resourceId: String(input.pageId), requestId: requestId(ctx.req.headers) });
      return result;
    } catch (error) { return operationError(error, "تعذر حذف صفحة الدخول الآن"); }
  }),
});
