import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createOrganizationForUser, getTenantOverview, getTenantPlanUsage, listActiveTenantMemberships } from "../db";
import { protectedProcedure, router, tenantPermissionProcedure } from "../_core/trpc";

const organizationInput = z.object({
  name: z.string().trim().min(3, "اسم المؤسسة قصير جدًا").max(160),
  slug: z.string().trim().min(3).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "استخدم حروفًا إنجليزية صغيرة وأرقامًا وشرطات فقط"),
  timezone: z.string().trim().min(3).max(64).default("Asia/Riyadh"),
  currency: z.string().trim().toUpperCase().length(3).default("SAR"),
});

import { exportFullTenantData } from "../db";

export const tenantRouter = router({
  exportData: tenantPermissionProcedure("accounting:read").mutation(async ({ ctx }) => {
    try {
      const payload = await exportFullTenantData(ctx.tenant.organizationId);
      return { success: true, payload };
    } catch (error) {
      console.error("[Tenant] Failed to export data", error);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر تصدير البيانات الآن" });
    }
  }),
  listMine: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await listActiveTenantMemberships(ctx.user.id);
    } catch (error) {
      console.error("[Tenant] Failed to list memberships", error);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر تحميل المؤسسات الآن" });
    }
  }),

  create: protectedProcedure.input(organizationInput).mutation(async ({ ctx, input }) => {
    try {
      return await createOrganizationForUser({ ...input, userId: ctx.user.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : "تعذر إنشاء المؤسسة";
      if (/duplicate|unique/i.test(message)) {
        throw new TRPCError({ code: "CONFLICT", message: "معرّف المؤسسة مستخدم بالفعل" });
      }
      console.error("[Tenant] Failed to create organization", error);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر إنشاء المؤسسة الآن" });
    }
  }),

  overview: tenantPermissionProcedure("workspace:read").query(async ({ ctx }) => {
    try {
      const overview = await getTenantOverview(ctx.tenant.organizationId);
      return {
        mode: "operational" as const,
        organization: {
          id: ctx.tenant.organizationId,
          slug: ctx.tenant.organizationSlug,
          name: ctx.tenant.organizationName,
          status: ctx.tenant.organizationStatus,
          role: ctx.tenant.memberRole,
        },
        ...overview,
      };
    } catch (error) {
      console.error("[Tenant] Failed to load overview", error);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر تحميل ملخص المؤسسة الآن" });
    }
  }),
  planUsage: tenantPermissionProcedure("workspace:read").query(async ({ ctx }) => {
    try { return await getTenantPlanUsage(ctx.tenant.organizationId); }
    catch (error) { console.error("[Tenant] Failed to load plan usage", error); throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر تحميل حدود الخطة الآن" }); }
  }),
});
