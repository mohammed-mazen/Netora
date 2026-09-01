import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { tenantSelectorSchema, type TenantPermission } from "../access";
import { hasEffectiveTenantPermission, recordAuditEvent, resolveTenantAccess } from "../db";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

function requestIdFromContext(ctx: TrpcContext) {
  const header = ctx.req.headers["x-request-id"];
  const value = Array.isArray(header) ? header[0] : header;
  return value?.slice(0, 100) || crypto.randomUUID();
}

/**
 * Requires an active membership resolved server-side from ctx.user and organizationSlug.
 * The resulting tenant context is available to all child procedures.
 */
export const tenantProcedure = protectedProcedure
  .input(tenantSelectorSchema)
  .use(async ({ ctx, input, next }) => {
    let tenant;
    try {
      tenant = await resolveTenantAccess(ctx.user.id, input.organizationSlug);
    } catch (error) {
      console.error("[Tenant] Membership lookup failed", error);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر التحقق من سياق المؤسسة الآن" });
    }

    if (!tenant) {
      throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك عضوية نشطة في هذه المؤسسة" });
    }

    return next({ ctx: { ...ctx, tenant } });
  });

export function tenantPermissionProcedure(permission: TenantPermission) {
  return tenantProcedure.use(async ({ ctx, next }) => {
    // Checks the base 6-role matrix OR any custom fine-grained role grant
    // (see server/db.ts hasEffectiveTenantPermission) — this is what lets an
    // organization owner grant a narrow permission (e.g. "reports:builder")
    // to a member whose base role wouldn't otherwise include it.
    if (!(await hasEffectiveTenantPermission(ctx.tenant, permission))) {
      await recordAuditEvent({
        organizationId: ctx.tenant.organizationId,
        actorUserId: ctx.user.id,
        action: "authorization.denied",
        resourceType: "tenant_permission",
        resourceId: permission,
        requestId: requestIdFromContext(ctx),
        outcome: "denied",
        metadata: { membershipRole: ctx.tenant.memberRole, requestedPermission: permission },
      });
      throw new TRPCError({ code: "FORBIDDEN", message: "صلاحيتك لا تسمح بهذا الإجراء" });
    }

    return next({ ctx });
  });
}
