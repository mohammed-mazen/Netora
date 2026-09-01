import { describe, expect, it } from "vitest";
import * as OTPAuth from "otpauth";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import { getUserByEmail } from "./db";

type CookieCall = { name: string; value: string; options: Record<string, unknown> };

function createContext(user: Awaited<ReturnType<typeof getUserByEmail>> | null = null): { ctx: TrpcContext; setCookies: CookieCall[]; clearedCookies: CookieCall[] } {
  const setCookies: CookieCall[] = [];
  const clearedCookies: CookieCall[] = [];
  return {
    setCookies,
    clearedCookies,
    ctx: {
      user,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {
        cookie: (name: string, value: string, options: Record<string, unknown>) => setCookies.push({ name, value, options }),
        clearCookie: (name: string, options: Record<string, unknown>) => clearedCookies.push({ name, value: "", options }),
      } as TrpcContext["res"],
    },
  };
}

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@netora-test.local`;
}

function totpCode(secret: string) {
  const totp = new OTPAuth.TOTP({ issuer: "Netora", algorithm: "SHA1", digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(secret) });
  return totp.generate();
}

describe("auth two-factor lifecycle", () => {
  it("enables 2FA, enforces challenge on login, supports recovery codes, and can be disabled", async () => {
    const email = uniqueEmail("twofactor");
    const publicCtx = createContext();
    const publicCaller = appRouter.createCaller(publicCtx.ctx);

    await publicCaller.auth.register({ email, password: "StrongPass123", name: "صاحب الحساب" });
    expect(publicCtx.setCookies[0]?.name).toBe(COOKIE_NAME);

    const user = await getUserByEmail(email);
    expect(user).toBeTruthy();
    const authedCaller = appRouter.createCaller(createContext(user).ctx);

    const setup = await authedCaller.auth.twoFactor.begin();
    expect(setup.recoveryCodes).toHaveLength(8);

    await expect(authedCaller.auth.twoFactor.confirm({ code: totpCode(setup.secret) })).resolves.toEqual({ success: true });
    await expect(authedCaller.auth.twoFactor.status()).resolves.toMatchObject({ enabled: true });

    const loginCaller = appRouter.createCaller(createContext().ctx);
    const login = await loginCaller.auth.login({ email, password: "StrongPass123" });
    expect(login.requiresTwoFactor).toBe(true);
    if (!login.requiresTwoFactor) throw new Error("Expected 2FA challenge");

    const verificationCtx = createContext();
    const verifiedUser = await appRouter.createCaller(verificationCtx.ctx).auth.verifyTwoFactor({ challengeToken: login.challengeToken, code: totpCode(setup.secret) });
    expect(verifiedUser.email).toBe(email);
    expect(verificationCtx.setCookies[0]?.name).toBe(COOKIE_NAME);

    const regenerated = await authedCaller.auth.twoFactor.regenerateRecoveryCodes({ currentPassword: "StrongPass123" });
    expect(regenerated.recoveryCodes).toHaveLength(8);

    const secondLogin = await loginCaller.auth.login({ email, password: "StrongPass123" });
    expect(secondLogin.requiresTwoFactor).toBe(true);
    if (!secondLogin.requiresTwoFactor) throw new Error("Expected 2FA challenge");
    const recoveryUser = await appRouter.createCaller(createContext().ctx).auth.verifyTwoFactor({ challengeToken: secondLogin.challengeToken, code: regenerated.recoveryCodes[0]! });
    expect(recoveryUser.usedRecoveryCode).toBe(true);

    await expect(authedCaller.auth.twoFactor.disable({ currentPassword: "StrongPass123" })).resolves.toEqual({ success: true });
    await expect(authedCaller.auth.twoFactor.status()).resolves.toMatchObject({ enabled: false });

    const finalLogin = await loginCaller.auth.login({ email, password: "StrongPass123" });
    expect(finalLogin.requiresTwoFactor).toBe(false);
  });
});
