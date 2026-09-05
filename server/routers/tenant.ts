import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createOrganizationForUser, getTenantOverview, getTenantPlanUsage, listActiveTenantMemberships } from "../db";
import { protectedProcedure, publicProcedure, router, tenantPermissionProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { users, organizations, organizationMembers, organizationSubscriptions, subscriptionPlans } from "../../drizzle/schema";

const organizationInput = z.object({
  name: z.string().trim().min(3, "اسم المؤسسة قصير جدًا").max(160),
  slug: z.string().trim().min(3).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "استخدم حروفًا إنجليزية صغيرة وأرقامًا وشرطات فقط"),
  timezone: z.string().trim().min(3).max(64).default("Asia/Riyadh"),
  currency: z.string().trim().toUpperCase().length(3).default("SAR"),
});

const trialInput = z.object({
  name: z.string().trim().min(3, "اسم المؤسسة قصير جدًا").max(160),
  slug: z.string().trim().min(3).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "استخدم حروفًا إنجليزية صغيرة وأرقامًا وشرطات فقط"),
  timezone: z.string().trim().min(3).max(64).default("Asia/Riyadh"),
  currency: z.string().trim().toUpperCase().length(3).default("SAR"),
  email: z.string().email("بريد إلكتروني غير صالح").trim().toLowerCase(),
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
  userName: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  honeypot: z.string().max(0, "Invalid submission").optional(),
});

import { exportFullTenantData } from "../db";
import { hashPassword } from "../_core/auth";
import { eq } from "drizzle-orm";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { auth } from "../_core/auth";

export const tenantRouter = router({
  createTrial: publicProcedure.input(trialInput).mutation(async ({ input, ctx }) => {
    if (input.honeypot) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid submission" });
    }

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    try {
      return await db.transaction(async tx => {
        let userResult = await tx.select().from(users).where(eq(users.email, input.email)).limit(1);
        let user = userResult[0];

        let userId: number;
        if (user) {
           userId = user.id;
        } else {
           const passwordHash = await hashPassword(input.password);
           const result = await tx.insert(users).values({
               email: input.email,
               passwordHash,
               name: input.userName ?? null,
               role: "user"
           });
           userId = Number(result[0].insertId);
        }

        const insertedOrg = await tx.insert(organizations).values({
            name: input.name,
            slug: input.slug,
            status: "trial",
            timezone: input.timezone,
            currency: input.currency,
        });

        const organizationId = Number(insertedOrg[0]?.insertId);

        await tx.insert(organizationMembers).values({
            organizationId,
            userId: userId,
            role: "owner",
            status: "active",
        });

        const subscriptionPlanResult = await tx.select().from(subscriptionPlans).where(eq(subscriptionPlans.isActive, 1)).limit(1);
        let subscriptionPlan = subscriptionPlanResult[0];

        if (subscriptionPlan) {
            await tx.insert(organizationSubscriptions).values({
                organizationId,
                planId: subscriptionPlan.id,
                status: "trialing",
            });
        }

        // Log the user in
        const token = await auth.createSessionToken(userId);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, cookieOptions);

        return { success: true };
      });
    } catch (e) {
      console.error(e);
      if (e instanceof Error && /duplicate|unique/i.test(e.message)) {
          throw new TRPCError({ code: "CONFLICT", message: "معرّف المؤسسة أو البريد الإلكتروني مستخدم بالفعل" });
      }
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر إنشاء المؤسسة الآن" });
    }
  }),
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
