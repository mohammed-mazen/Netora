import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

const moduleSchema = z.enum([
  "dashboard",
  "network",
  "customers",
  "vouchers",
  "sessions",
  "billing",
  "support",
  "settings",
  "platform",
]);

const overview = {
  mode: "preview" as const,
  dataFreshness: "واجهة عرض قبل ربط خوادم الشبكة",
  workspace: {
    organizationName: "مساحة مؤسستك",
    planName: "خطة Netora التجريبية",
    subscriptionStatus: "قيد التهيئة",
  },
  network: {
    activeSessions: 0,
    healthyRouters: 0,
    totalRouters: 0,
    usagePercent: 0,
  },
  finance: {
    monthlyRevenue: 0,
    openInvoices: 0,
    outstandingBalance: 0,
  },
};

export const netoraRouter = router({
  overview: protectedProcedure.query(({ ctx }) => ({
    ...overview,
    actor: {
      name: ctx.user.name ?? "مستخدم Netora",
      email: ctx.user.email ?? null,
      platformRole: ctx.user.role,
    },
  })),
  workspace: protectedProcedure.input(z.object({ module: moduleSchema })).query(({ input }) => ({
    module: input.module,
    status: "ready_for_configuration",
    message: "تحتاج هذه الوحدة إلى ربط بيانات مؤسستك قبل عرض معلومات تشغيلية فعلية.",
  })),
});
