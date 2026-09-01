import { z } from "zod";
import {
  listTenantCompetitions,
  createTenantCompetition,
  updateTenantCompetitionStatus,
  listTenantCompetitionQuestions,
  createTenantCompetitionQuestion,
  submitTenantCompetitionEntry,
} from "../db";
import { router, tenantPermissionProcedure } from "../_core/trpc";
import { auditMutation, operationError, paginationInput, requestId } from "./_shared";

export const competitionsRouter = router({
  list: tenantPermissionProcedure("competitions:read").input(z.object({ ...paginationInput, status: z.enum(["draft", "active", "ended"]).optional() })).query(async ({ ctx, input }) => {
    try { return await listTenantCompetitions(ctx.tenant.organizationId, input); }
    catch (error) { return operationError(error, "تعذر تحميل المسابقات الآن"); }
  }),
  create: tenantPermissionProcedure("competitions:write").input(z.object({
    name: z.string().trim().min(2).max(160),
    easyPoints: z.number().int().min(0).max(10_000).optional(),
    mediumPoints: z.number().int().min(0).max(10_000).optional(),
    hardPoints: z.number().int().min(0).max(10_000).optional(),
    duration: z.enum(["daily", "weekly", "one_time"]).optional(),
    questionsPerDuration: z.number().int().min(1).max(100).optional(),
    startsAt: z.date().nullable().optional(),
    endsAt: z.date().nullable().optional(),
  })).mutation(async ({ ctx, input }) => {
    try {
      const result = await createTenantCompetition({ ...input, organizationId: ctx.tenant.organizationId, userId: ctx.user.id });
      await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "competition.create", resourceType: "competition", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { name: result.name } });
      return result;
    } catch (error) { return operationError(error, "تعذر إنشاء المسابقة الآن"); }
  }),
  updateStatus: tenantPermissionProcedure("competitions:write").input(z.object({ competitionId: z.number().int().positive(), status: z.enum(["draft", "active", "ended"]) })).mutation(async ({ ctx, input }) => {
    try {
      const result = await updateTenantCompetitionStatus({ ...input, organizationId: ctx.tenant.organizationId });
      await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "competition.status_update", resourceType: "competition", resourceId: String(input.competitionId), requestId: requestId(ctx.req.headers), metadata: { status: result.status } });
      return result;
    } catch (error) { return operationError(error, "تعذر تحديث حالة المسابقة الآن"); }
  }),
  questions: router({
    list: tenantPermissionProcedure("competitions:read").input(z.object({ competitionId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      try { return await listTenantCompetitionQuestions(ctx.tenant.organizationId, input.competitionId); }
      catch (error) { return operationError(error, "تعذر تحميل أسئلة المسابقة الآن"); }
    }),
    create: tenantPermissionProcedure("competitions:write").input(z.object({
      competitionId: z.number().int().positive(),
      difficulty: z.enum(["easy", "medium", "hard"]),
      question: z.string().trim().min(1).max(2000),
      correctAnswer: z.string().trim().min(1).max(400),
    })).mutation(async ({ ctx, input }) => {
      try {
        const result = await createTenantCompetitionQuestion({ ...input, organizationId: ctx.tenant.organizationId });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "competition_question.create", resourceType: "competition_question", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { competitionId: input.competitionId, difficulty: input.difficulty } });
        return result;
      } catch (error) { return operationError(error, "تعذر إنشاء السؤال الآن"); }
    }),
  }),
  entries: router({
    submit: tenantPermissionProcedure("competitions:write").input(z.object({
      competitionId: z.number().int().positive(),
      customerId: z.number().int().positive(),
      questionId: z.number().int().positive(),
      answer: z.string().trim().min(1).max(400),
    })).mutation(async ({ ctx, input }) => {
      try {
        const result = await submitTenantCompetitionEntry({ ...input, organizationId: ctx.tenant.organizationId, userId: ctx.user.id });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "competition_entry.submit", resourceType: "competition_entry", requestId: requestId(ctx.req.headers), metadata: { competitionId: input.competitionId, customerId: input.customerId, correct: result.correct, pointsEarned: result.pointsEarned } });
        return result;
      } catch (error) { return operationError(error, "تعذر تسجيل المشاركة الآن"); }
    }),
  }),
});
