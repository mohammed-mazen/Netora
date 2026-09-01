import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { assignPlatformOrganizationSubscription, createPlatformSubscriptionPlan, listPlatformOrganizations, listPlatformOrganizationSubscriptions, listPlatformSubscriptionPlans, listPlatformSupportTickets, recordAuditEvent } from "../db";
import { adminProcedure, router } from "../_core/trpc";

function platformError(error: unknown, fallback: string): never {
  const message = error instanceof Error ? error.message : fallback;
  if (/duplicate|unique/i.test(message)) throw new TRPCError({ code: "CONFLICT", message: "رمز الخطة مستخدم بالفعل" });
  console.error("[Platform] Operation failed", error);
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: fallback });
}

export const platformRouter = router({
  organizations: adminProcedure.input(z.object({ limit: z.number().int().min(1).max(100).default(25), offset: z.number().int().min(0).default(0), search: z.string().trim().max(120).optional() })).query(async ({ input }) => {
    try { return await listPlatformOrganizations(input); }
    catch (error) { return platformError(error, "تعذر تحميل المؤسسات الآن"); }
  }),
  subscriptionPlans: router({
    list: adminProcedure.input(z.object({ limit: z.number().int().min(1).max(100).default(25), offset: z.number().int().min(0).default(0), search: z.string().trim().max(120).optional() })).query(async ({ input }) => {
      try { return await listPlatformSubscriptionPlans(input); }
      catch (error) { return platformError(error, "تعذر تحميل خطط المنصة الآن"); }
    }),
    create: adminProcedure.input(z.object({
      code: z.string().trim().toLowerCase().min(3).max(40).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      name: z.string().trim().min(3).max(120), description: z.string().trim().max(1000).nullable().optional(),
      monthlyPrice: z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/), routerLimit: z.number().int().min(0).max(100_000),
      customerLimit: z.number().int().min(0).max(10_000_000), staffLimit: z.number().int().min(0).max(100_000), storageLimitMb: z.number().int().min(0).max(10_000_000),
    })).mutation(async ({ ctx, input }) => {
      try {
        const plan = await createPlatformSubscriptionPlan(input);
        const header = ctx.req.headers["x-request-id"];
        await recordAuditEvent({ organizationId: null, actorUserId: ctx.user.id, action: "platform_plan.create", resourceType: "subscription_plan", resourceId: String(plan.id), requestId: (Array.isArray(header) ? header[0] : header)?.slice(0, 100) || crypto.randomUUID(), outcome: "success", metadata: { code: plan.code } });
        return plan;
      } catch (error) { return platformError(error, "تعذر حفظ خطة المنصة الآن"); }
    }),
  }),
  subscriptions: adminProcedure.input(z.object({ limit: z.number().int().min(1).max(100).default(25), offset: z.number().int().min(0).default(0), search: z.string().trim().max(120).optional(), status: z.enum(["trialing", "active", "past_due", "suspended", "cancelled"]).optional() })).query(async ({ input }) => {
    try { return await listPlatformOrganizationSubscriptions(input); }
    catch (error) { return platformError(error, "تعذر تحميل اشتراكات المؤسسات الآن"); }
  }),
  supportTickets: adminProcedure.input(z.object({ limit: z.number().int().min(1).max(100).default(25), offset: z.number().int().min(0).default(0), search: z.string().trim().max(120).optional(), status: z.enum(["open", "pending", "resolved", "closed"]).optional() })).query(async ({ input }) => {
    try { return await listPlatformSupportTickets(input); }
    catch (error) { return platformError(error, "تعذر تحميل تذاكر المنصة الآن"); }
  }),
  assignSubscription: adminProcedure.input(z.object({ organizationId: z.number().int().positive(), planId: z.number().int().positive(), status: z.enum(["trialing", "active", "past_due", "suspended", "cancelled"]), endsAt: z.date().nullable().optional() })).mutation(async ({ ctx, input }) => {
    try {
      const subscription = await assignPlatformOrganizationSubscription(input);
      const header = ctx.req.headers["x-request-id"];
      await recordAuditEvent({ organizationId: null, actorUserId: ctx.user.id, action: "platform_subscription.assign", resourceType: "organization_subscription", resourceId: String(subscription.id), requestId: (Array.isArray(header) ? header[0] : header)?.slice(0, 100) || crypto.randomUUID(), outcome: "success", metadata: { organizationId: input.organizationId, planId: input.planId, status: input.status } });
      return subscription;
    } catch (error) { return platformError(error, "تعذر إسناد اشتراك المؤسسة الآن"); }
  }),
});
