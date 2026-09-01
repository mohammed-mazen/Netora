import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { auth, hashPassword, isValidEmail, isValidPassword, verifyPassword } from "../_core/auth";
import { getSessionCookieOptions } from "../_core/cookies";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { createUserWithPassword, getUserByEmail, getUserById, recordFailedLoginAttempt, touchUserLastSignedIn } from "../db";
import { beginTwoFactorSetup, confirmTwoFactorSetup, disableTwoFactor, getTwoFactorStatus, regenerateRecoveryCodes, verifyTwoFactorChallenge } from "../twoFactor";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().refine(isValidEmail, "بريد إلكتروني غير صالح"),
  password: z.string().refine(isValidPassword, "كلمة المرور يجب أن تكون بين 8 و200 حرف"),
});

const registerSchema = credentialsSchema.extend({
  name: z.string().trim().min(1).max(160).optional(),
});

function minutesUntil(date: Date): number {
  return Math.max(1, Math.ceil((date.getTime() - Date.now()) / 60_000));
}

async function issueSession(userId: number, ctx: { req: any; res: any }) {
  const token = await auth.createSessionToken(userId);
  const cookieOptions = getSessionCookieOptions(ctx.req);
  ctx.res.cookie(COOKIE_NAME, token, cookieOptions);
}

export const authRouter = router({
  me: publicProcedure.query(opts => opts.ctx.user),

  register: publicProcedure.input(registerSchema).mutation(async ({ input, ctx }) => {
    const existing = await getUserByEmail(input.email);
    if (existing) {
      throw new TRPCError({ code: "CONFLICT", message: "البريد الإلكتروني مسجل بالفعل، جرّب تسجيل الدخول" });
    }

    const passwordHash = await hashPassword(input.password);
    const user = await createUserWithPassword({ email: input.email, passwordHash, name: input.name ?? null });
    await issueSession(user.id, ctx);
    return user;
  }),

  login: publicProcedure.input(credentialsSchema).mutation(async ({ input, ctx }) => {
    const invalidCredentialsError = new TRPCError({ code: "UNAUTHORIZED", message: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });

    const user = await getUserByEmail(input.email);
    // Same generic message whether the email doesn't exist or the password
    // is wrong (no account enumeration) — but a *locked* existing account
    // gets a distinct, honest message since the user legitimately needs to
    // know to wait rather than keep guessing.
    if (!user) throw invalidCredentialsError;

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `الحساب مقفل مؤقتًا بسبب محاولات دخول فاشلة متكررة. حاول مرة أخرى بعد ${minutesUntil(user.lockedUntil)} دقيقة.`,
      });
    }

    const passwordMatches = await verifyPassword(input.password, user.passwordHash);
    if (!passwordMatches) {
      const { attempts, lockedUntil } = await recordFailedLoginAttempt(user.id);
      if (lockedUntil) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `تم قفل الحساب مؤقتًا بعد ${attempts} محاولات فاشلة. حاول مرة أخرى بعد ${minutesUntil(lockedUntil)} دقيقة.`,
        });
      }
      throw invalidCredentialsError;
    }

    // Password confirmed. If the account has TOTP 2FA enabled (see
    // server/twoFactor.ts), do NOT issue a session cookie yet — instead
    // return a short-lived challenge token (5 min, see
    // auth.createTwoFactorChallengeToken) the client must exchange for a
    // real session via `verifyTwoFactor` below. This is Netora's answer to
    // the competitor's audited `two-factor.login` route — but unlike a bare
    // "enter code" form with no context, the challenge token is itself
    // cryptographically scoped (kind: "2fa_challenge") so it can never be
    // replayed as a session, even if intercepted.
    if (user.twoFactorEnabled) {
      const challengeToken = await auth.createTwoFactorChallengeToken(user.id);
      return { requiresTwoFactor: true as const, challengeToken };
    }

    await touchUserLastSignedIn(user.id);
    await issueSession(user.id, ctx);
    return { requiresTwoFactor: false as const, user: { ...user, lastSignedIn: new Date(), failedLoginAttempts: 0, lockedUntil: null } };
  }),

  /** Step 2 of 2FA login: exchanges a valid challenge token + a TOTP/recovery code for a real session cookie. */
  verifyTwoFactor: publicProcedure
    .input(z.object({ challengeToken: z.string().min(10).max(2000), code: z.string().trim().min(4).max(40) }))
    .mutation(async ({ input, ctx }) => {
      const challenge = await auth.verifyTwoFactorChallengeToken(input.challengeToken);
      if (!challenge) throw new TRPCError({ code: "UNAUTHORIZED", message: "انتهت صلاحية جلسة التحقق، سجّل الدخول من جديد" });

      const result = await verifyTwoFactorChallenge({ userId: challenge.userId, code: input.code });
      if (!result.success) throw new TRPCError({ code: "UNAUTHORIZED", message: "رمز التحقق غير صحيح" });

      const user = await getUserById(challenge.userId);
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "الحساب غير موجود" });

      await touchUserLastSignedIn(user.id);
      await issueSession(user.id, ctx);
      return { ...user, lastSignedIn: new Date(), failedLoginAttempts: 0, lockedUntil: null, usedRecoveryCode: result.usedRecoveryCode };
    }),

  twoFactor: router({
    status: protectedProcedure.query(async ({ ctx }) => getTwoFactorStatus(ctx.user.id)),
    begin: protectedProcedure.mutation(async ({ ctx }) => {
      try {
        return await beginTwoFactorSetup({ userId: ctx.user.id, userEmail: ctx.user.email });
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "تعذر بدء إعداد التحقق بخطوتين" });
      }
    }),
    confirm: protectedProcedure.input(z.object({ code: z.string().trim().min(6).max(20) })).mutation(async ({ ctx, input }) => {
      try {
        return await confirmTwoFactorSetup({ userId: ctx.user.id, code: input.code });
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "تعذر تأكيد التحقق بخطوتين" });
      }
    }),
    regenerateRecoveryCodes: protectedProcedure.input(z.object({ currentPassword: z.string().min(8).max(200) })).mutation(async ({ ctx, input }) => {
      const ok = await verifyPassword(input.currentPassword, ctx.user.passwordHash);
      if (!ok) throw new TRPCError({ code: "UNAUTHORIZED", message: "كلمة المرور الحالية غير صحيحة" });
      try {
        return { recoveryCodes: await regenerateRecoveryCodes(ctx.user.id) };
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "تعذر إعادة إنشاء رموز الاستعادة" });
      }
    }),
    disable: protectedProcedure.input(z.object({ currentPassword: z.string().min(8).max(200) })).mutation(async ({ ctx, input }) => {
      const ok = await verifyPassword(input.currentPassword, ctx.user.passwordHash);
      if (!ok) throw new TRPCError({ code: "UNAUTHORIZED", message: "كلمة المرور الحالية غير صحيحة" });
      try {
        return await disableTwoFactor(ctx.user.id);
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "تعذر تعطيل التحقق بخطوتين" });
      }
    }),
  }),
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),
});
