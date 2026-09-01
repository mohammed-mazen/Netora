import { z } from "zod";
import { createTenantApiToken, listTenantApiTokens, revokeTenantApiToken } from "../db";
import { router, tenantPermissionProcedure } from "../_core/trpc";
import { auditMutation, operationError, requestId } from "./_shared";

const abilitySchema = z.enum(["create", "read", "update", "delete"]);

export const apiTokensRouter = router({
  list: tenantPermissionProcedure("apiTokens:read").query(async ({ ctx }) => {
    try {
      return await listTenantApiTokens({ organizationId: ctx.tenant.organizationId, userId: ctx.user.id });
    } catch (error) { return operationError(error, "تعذر تحميل رموز API الآن"); }
  }),
  create: tenantPermissionProcedure("apiTokens:write").input(z.object({
    name: z.string().trim().min(2).max(140),
    abilities: z.array(abilitySchema).min(1).max(4),
    ipAllowlist: z.array(z.string().trim().min(3).max(80)).max(20).optional(),
    expiresAt: z.coerce.date().nullable().optional(),
  })).mutation(async ({ ctx, input }) => {
    try {
      const result = await createTenantApiToken({ organizationId: ctx.tenant.organizationId, userId: ctx.user.id, ...input });
      await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "api_token.create", resourceType: "api_token", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { name: result.name, abilities: input.abilities } });
      return result;
    } catch (error) { return operationError(error, "تعذر إنشاء رمز API الآن"); }
  }),
  revoke: tenantPermissionProcedure("apiTokens:write").input(z.object({ tokenId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    try {
      const result = await revokeTenantApiToken({ organizationId: ctx.tenant.organizationId, userId: ctx.user.id, tokenId: input.tokenId });
      await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "api_token.revoke", resourceType: "api_token", resourceId: String(input.tokenId), requestId: requestId(ctx.req.headers) });
      return result;
    } catch (error) { return operationError(error, "تعذر إلغاء رمز API الآن"); }
  }),
});
