import { z } from "zod";
import {
  listTenantChatThreads,
  createTenantChatThread,
  updateTenantChatThreadStatus,
  listTenantChatMessages,
  postTenantChatMessage,
} from "../db";
import { router, tenantPermissionProcedure } from "../_core/trpc";
import { auditMutation, operationError, paginationInput, requestId } from "./_shared";

export const chatRouter = router({
  threads: router({
    list: tenantPermissionProcedure("chat:read").input(z.object({ ...paginationInput, status: z.enum(["open", "closed"]).optional() })).query(async ({ ctx, input }) => {
      try { return await listTenantChatThreads(ctx.tenant.organizationId, input); }
      catch (error) { return operationError(error, "تعذر تحميل محادثات الدعم الآن"); }
    }),
    create: tenantPermissionProcedure("chat:write").input(z.object({ customerId: z.number().int().positive().nullable().optional(), subject: z.string().trim().max(200).nullable().optional() })).mutation(async ({ ctx, input }) => {
      try {
        const result = await createTenantChatThread({ ...input, organizationId: ctx.tenant.organizationId });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "chat_thread.create", resourceType: "chat_thread", resourceId: String(result.id), requestId: requestId(ctx.req.headers) });
        return result;
      } catch (error) { return operationError(error, "تعذر إنشاء المحادثة الآن"); }
    }),
    updateStatus: tenantPermissionProcedure("chat:write").input(z.object({ threadId: z.number().int().positive(), status: z.enum(["open", "closed"]) })).mutation(async ({ ctx, input }) => {
      try {
        const result = await updateTenantChatThreadStatus({ ...input, organizationId: ctx.tenant.organizationId });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "chat_thread.status_update", resourceType: "chat_thread", resourceId: String(input.threadId), requestId: requestId(ctx.req.headers), metadata: { status: result.status } });
        return result;
      } catch (error) { return operationError(error, "تعذر تحديث حالة المحادثة الآن"); }
    }),
  }),
  messages: router({
    list: tenantPermissionProcedure("chat:read").input(z.object({ threadId: z.number().int().positive(), limit: z.number().int().min(1).max(200).default(100) })).query(async ({ ctx, input }) => {
      try { return await listTenantChatMessages(ctx.tenant.organizationId, input.threadId, input); }
      catch (error) { return operationError(error, "تعذر تحميل رسائل المحادثة الآن"); }
    }),
    post: tenantPermissionProcedure("chat:write").input(z.object({
      threadId: z.number().int().positive(),
      senderKind: z.enum(["staff", "customer"]),
      body: z.string().trim().min(1).max(5000),
    })).mutation(async ({ ctx, input }) => {
      try {
        const result = await postTenantChatMessage({ ...input, organizationId: ctx.tenant.organizationId, senderUserId: input.senderKind === "staff" ? ctx.user.id : null });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "chat_message.post", resourceType: "chat_thread", resourceId: String(input.threadId), requestId: requestId(ctx.req.headers), metadata: { senderKind: input.senderKind, messageLength: input.body.length } });
        return result;
      } catch (error) { return operationError(error, "تعذر إرسال الرسالة الآن"); }
    }),
  }),
});
