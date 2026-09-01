import { z } from "zod";
import {
  listTenantCustomRoles,
  createTenantCustomRole,
  updateTenantCustomRolePermissions,
  deleteTenantCustomRole,
  listTenantMembers,
  assignTenantMemberCustomRole,
} from "../db";
import { tenantPermissions } from "../access";
import { router, tenantPermissionProcedure } from "../_core/trpc";
import { auditMutation, operationError, requestId } from "./_shared";

const permissionSchema = z.enum(tenantPermissions);

export const rolesRouter = router({
  list: tenantPermissionProcedure("roles:read").query(async ({ ctx }) => {
    try { return await listTenantCustomRoles(ctx.tenant.organizationId); }
    catch (error) { return operationError(error, "تعذر تحميل الأدوار المخصصة الآن"); }
  }),
  create: tenantPermissionProcedure("roles:write").input(z.object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(300).nullable().optional(),
    permissions: z.array(permissionSchema).max(60),
  })).mutation(async ({ ctx, input }) => {
    try {
      const result = await createTenantCustomRole({ ...input, organizationId: ctx.tenant.organizationId, userId: ctx.user.id });
      await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "custom_role.create", resourceType: "custom_role", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { name: result.name, permissionCount: result.permissions.length } });
      return result;
    } catch (error) { return operationError(error, "تعذر إنشاء الدور الآن"); }
  }),
  updatePermissions: tenantPermissionProcedure("roles:write").input(z.object({ roleId: z.number().int().positive(), permissions: z.array(permissionSchema).max(60) })).mutation(async ({ ctx, input }) => {
    try {
      const result = await updateTenantCustomRolePermissions({ ...input, organizationId: ctx.tenant.organizationId });
      await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "custom_role.update_permissions", resourceType: "custom_role", resourceId: String(input.roleId), requestId: requestId(ctx.req.headers), metadata: { permissionCount: result.permissions.length } });
      return result;
    } catch (error) { return operationError(error, "تعذر تحديث صلاحيات الدور الآن"); }
  }),
  delete: tenantPermissionProcedure("roles:write").input(z.object({ roleId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    try {
      const result = await deleteTenantCustomRole({ ...input, organizationId: ctx.tenant.organizationId });
      await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "custom_role.delete", resourceType: "custom_role", resourceId: String(input.roleId), requestId: requestId(ctx.req.headers) });
      return result;
    } catch (error) { return operationError(error, "تعذر حذف الدور الآن"); }
  }),
  members: router({
    list: tenantPermissionProcedure("roles:read").query(async ({ ctx }) => {
      try { return await listTenantMembers(ctx.tenant.organizationId); }
      catch (error) { return operationError(error, "تعذر تحميل أعضاء المؤسسة الآن"); }
    }),
    assignRole: tenantPermissionProcedure("roles:write").input(z.object({ memberId: z.number().int().positive(), customRoleId: z.number().int().positive().nullable() })).mutation(async ({ ctx, input }) => {
      try {
        const result = await assignTenantMemberCustomRole({ ...input, organizationId: ctx.tenant.organizationId });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "member.assign_custom_role", resourceType: "organization_member", resourceId: String(input.memberId), requestId: requestId(ctx.req.headers), metadata: { customRoleId: input.customRoleId } });
        return result;
      } catch (error) { return operationError(error, "تعذر تحديث دور العضو الآن"); }
    }),
  }),
});
