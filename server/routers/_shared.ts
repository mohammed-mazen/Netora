// Shared helpers for the new (competitive-parity rebuild) tenant routers —
// accounting, cards, cardDesign, roles, reportBuilder, backup, monitor,
// points, sms, competitions, chat. Mirrors the equivalent local helpers in
// server/routers/workspace.ts (paginationInput/requestId/operationError/
// auditMutation) so both router families share identical error-shaping and
// audit-logging conventions without duplicating the logic per-file.
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { recordAuditEvent } from "../db";

export const paginationInput = {
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().min(0).default(0),
};

export const moneyRegex = /^\d{1,10}(?:\.\d{1,2})?$/;

export function requestId(headers: Record<string, string | string[] | undefined>) {
  const value = headers["x-request-id"];
  return (Array.isArray(value) ? value[0] : value)?.slice(0, 100) || crypto.randomUUID();
}

export function operationError(error: unknown, fallback: string): never {
  const message = error instanceof Error ? error.message : fallback;
  if (/duplicate|unique/i.test(message)) throw new TRPCError({ code: "CONFLICT", message: "يوجد سجل مطابق بالفعل في هذه المؤسسة" });
  if (/لا يتبع للمؤسسة/i.test(message)) throw new TRPCError({ code: "BAD_REQUEST", message });
  if (/لا يمكن|مطلوب|غير صالح|غير نشطة|مسبقًا/i.test(message)) throw new TRPCError({ code: "BAD_REQUEST", message });
  console.error("[TenantModule] Operation failed", error);
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: fallback });
}

export async function auditMutation(input: {
  organizationId: number; actorUserId: number; action: string; resourceType: string; resourceId?: string; requestId: string; metadata?: Record<string, unknown>;
}) {
  await recordAuditEvent({ ...input, outcome: "success" });
}
