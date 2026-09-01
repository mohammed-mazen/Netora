import { z } from "zod";
import {
  listTenantChartAccounts,
  createTenantChartAccount,
  listTenantCashBoxes,
  createTenantCashBox,
  listTenantWarehouses,
  createTenantWarehouse,
  listTenantStockTransfers,
  createTenantStockTransfer,
  updateTenantStockTransferStatus,
  listTenantCashVouchers,
  createTenantCashVoucher,
} from "../db";
import { router, tenantPermissionProcedure } from "../_core/trpc";
import { auditMutation, moneyRegex, operationError, paginationInput, requestId } from "./_shared";

export const accountingRouter = router({
  chartAccounts: router({
    list: tenantPermissionProcedure("accounting:read").input(z.object({ search: z.string().trim().max(120).optional() })).query(async ({ ctx, input }) => {
      try { return await listTenantChartAccounts(ctx.tenant.organizationId, input); }
      catch (error) { return operationError(error, "تعذر تحميل دليل الحسابات الآن"); }
    }),
    create: tenantPermissionProcedure("accounting:write").input(z.object({
      parentId: z.number().int().positive().nullable().optional(),
      accountNumber: z.string().trim().min(1).max(40),
      name: z.string().trim().min(2).max(160),
      kind: z.enum(["asset", "liability", "equity", "revenue", "expense"]),
      nature: z.enum(["debit", "credit"]),
    })).mutation(async ({ ctx, input }) => {
      try {
        const result = await createTenantChartAccount({ ...input, organizationId: ctx.tenant.organizationId });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "chart_account.create", resourceType: "chart_account", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { accountNumber: result.accountNumber } });
        return result;
      } catch (error) { return operationError(error, "تعذر إنشاء الحساب الآن"); }
    }),
  }),
  cashBoxes: router({
    list: tenantPermissionProcedure("accounting:read").query(async ({ ctx }) => {
      try { return await listTenantCashBoxes(ctx.tenant.organizationId); }
      catch (error) { return operationError(error, "تعذر تحميل الصناديق النقدية الآن"); }
    }),
    create: tenantPermissionProcedure("accounting:write").input(z.object({ name: z.string().trim().min(2).max(120), accountId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try {
        const result = await createTenantCashBox({ ...input, organizationId: ctx.tenant.organizationId });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "cash_box.create", resourceType: "cash_box", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { name: result.name } });
        return result;
      } catch (error) { return operationError(error, "تعذر إنشاء الصندوق الآن"); }
    }),
  }),
  warehouses: router({
    list: tenantPermissionProcedure("accounting:read").query(async ({ ctx }) => {
      try { return await listTenantWarehouses(ctx.tenant.organizationId); }
      catch (error) { return operationError(error, "تعذر تحميل المخازن الآن"); }
    }),
    create: tenantPermissionProcedure("accounting:write").input(z.object({ name: z.string().trim().min(2).max(120), location: z.string().trim().max(200).nullable().optional(), accountId: z.number().int().positive().nullable().optional() })).mutation(async ({ ctx, input }) => {
      try {
        const result = await createTenantWarehouse({ ...input, organizationId: ctx.tenant.organizationId });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "warehouse.create", resourceType: "warehouse", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { name: result.name } });
        return result;
      } catch (error) { return operationError(error, "تعذر إنشاء المخزن الآن"); }
    }),
  }),
  stockTransfers: router({
    list: tenantPermissionProcedure("accounting:read").input(z.object(paginationInput)).query(async ({ ctx, input }) => {
      try { return await listTenantStockTransfers(ctx.tenant.organizationId, input); }
      catch (error) { return operationError(error, "تعذر تحميل تحويلات المخزون الآن"); }
    }),
    create: tenantPermissionProcedure("accounting:write").input(z.object({
      fromWarehouseId: z.number().int().positive().nullable().optional(),
      toWarehouseId: z.number().int().positive().nullable().optional(),
      itemDescription: z.string().trim().min(1).max(200),
      quantity: z.number().int().positive().max(1_000_000),
    })).mutation(async ({ ctx, input }) => {
      try {
        const result = await createTenantStockTransfer({ ...input, organizationId: ctx.tenant.organizationId, userId: ctx.user.id });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "stock_transfer.create", resourceType: "stock_transfer", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { reference: result.reference } });
        return result;
      } catch (error) { return operationError(error, "تعذر إنشاء تحويل المخزون الآن"); }
    }),
    updateStatus: tenantPermissionProcedure("accounting:write").input(z.object({ transferId: z.number().int().positive(), status: z.enum(["confirmed", "cancelled"]) })).mutation(async ({ ctx, input }) => {
      try {
        const result = await updateTenantStockTransferStatus({ ...input, organizationId: ctx.tenant.organizationId });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "stock_transfer.status_update", resourceType: "stock_transfer", resourceId: String(input.transferId), requestId: requestId(ctx.req.headers), metadata: { status: result.status } });
        return result;
      } catch (error) { return operationError(error, "تعذر تحديث حالة تحويل المخزون الآن"); }
    }),
  }),
  cashVouchers: router({
    list: tenantPermissionProcedure("accounting:read").input(z.object({ ...paginationInput, kind: z.enum(["receipt", "payment"]).optional() })).query(async ({ ctx, input }) => {
      try { return await listTenantCashVouchers(ctx.tenant.organizationId, input); }
      catch (error) { return operationError(error, "تعذر تحميل سندات القبض والصرف الآن"); }
    }),
    create: tenantPermissionProcedure("accounting:write").input(z.object({
      cashBoxId: z.number().int().positive(),
      counterAccountId: z.number().int().positive(),
      customerId: z.number().int().positive().nullable().optional(),
      kind: z.enum(["receipt", "payment"]),
      amount: z.string().regex(moneyRegex, "قيمة السند غير صالحة"),
      description: z.string().trim().max(300).nullable().optional(),
    })).mutation(async ({ ctx, input }) => {
      try {
        const result = await createTenantCashVoucher({ ...input, organizationId: ctx.tenant.organizationId, userId: ctx.user.id });
        await auditMutation({ organizationId: ctx.tenant.organizationId, actorUserId: ctx.user.id, action: "cash_voucher.create", resourceType: "cash_voucher", resourceId: String(result.id), requestId: requestId(ctx.req.headers), metadata: { reference: result.reference, kind: input.kind, amount: input.amount } });
        return result;
      } catch (error) { return operationError(error, "تعذر إنشاء السند الآن"); }
    }),
  }),
});
