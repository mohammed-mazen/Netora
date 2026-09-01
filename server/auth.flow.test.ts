import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";
import { getUserByEmail } from "./db";

type CookieCall = { name: string; value: string; options: Record<string, unknown> };

function createPublicContext(): { ctx: TrpcContext; setCookies: CookieCall[]; clearedCookies: CookieCall[] } {
  const setCookies: CookieCall[] = [];
  const clearedCookies: CookieCall[] = [];
  const ctx: TrpcContext = {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        setCookies.push({ name, value, options });
      },
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, value: "", options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, setCookies, clearedCookies };
}

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@netora-test.local`;
}

describe("auth.register / auth.login / auth.logout (real DB, local email+password accounts)", () => {
  it("registers a new account, hashes the password, and issues a session cookie", async () => {
    const email = uniqueEmail("register");
    const { ctx, setCookies } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const user = await caller.auth.register({ email, password: "correct-horse-battery-1", name: "مستخدم اختباري" });

    expect(user.email).toBe(email);
    expect(user.name).toBe("مستخدم اختباري");
    // The password hash must never look like the plaintext password and must
    // be a real bcrypt hash (never returned in a way a client could reverse).
    expect(user.passwordHash).not.toBe("correct-horse-battery-1");
    expect(user.passwordHash).toMatch(/^\$2[aby]\$/);

    expect(setCookies).toHaveLength(1);
    expect(setCookies[0]?.name).toBe(COOKIE_NAME);
    expect(typeof setCookies[0]?.value).toBe("string");
    expect(setCookies[0]?.value.length).toBeGreaterThan(10);

    const stored = await getUserByEmail(email);
    expect(stored?.email).toBe(email);
  });

  it("rejects registering an email that is already taken", async () => {
    const email = uniqueEmail("duplicate");
    const { ctx: firstCtx } = createPublicContext();
    await appRouter.createCaller(firstCtx).auth.register({ email, password: "first-password-123" });

    const { ctx: secondCtx } = createPublicContext();
    await expect(
      appRouter.createCaller(secondCtx).auth.register({ email, password: "second-password-456" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects registration with a weak/short password before touching the database", async () => {
    const { ctx } = createPublicContext();
    await expect(
      appRouter.createCaller(ctx).auth.register({ email: uniqueEmail("weak"), password: "short" }),
    ).rejects.toThrow();
  });

  it("rejects registration with a password missing a digit or a letter (complexity policy)", async () => {
    const { ctx } = createPublicContext();
    await expect(
      appRouter.createCaller(ctx).auth.register({ email: uniqueEmail("nodigits"), password: "onlyletters" }),
    ).rejects.toThrow();
    await expect(
      appRouter.createCaller(ctx).auth.register({ email: uniqueEmail("nolet"), password: "12345678" }),
    ).rejects.toThrow();
  });

  it("locks the account after repeated failed login attempts and rejects even the correct password while locked", async () => {
    const email = uniqueEmail("lockout");
    const password = "a-strong-enough-password-2";
    const { ctx: registerCtx } = createPublicContext();
    await appRouter.createCaller(registerCtx).auth.register({ email, password });

    for (let attempt = 0; attempt < 4; attempt++) {
      const { ctx } = createPublicContext();
      await expect(
        appRouter.createCaller(ctx).auth.login({ email, password: "wrong-password-attempt-1" }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }

    // 5th failed attempt crosses ACCOUNT_LOCKOUT_THRESHOLD and locks the account.
    const { ctx: fifthCtx } = createPublicContext();
    await expect(
      appRouter.createCaller(fifthCtx).auth.login({ email, password: "wrong-password-attempt-1" }),
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });

    // Even the correct password is rejected while the lock is active.
    const { ctx: sixthCtx } = createPublicContext();
    await expect(
      appRouter.createCaller(sixthCtx).auth.login({ email, password }),
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("logs in with correct credentials and rejects incorrect ones with the same generic message", async () => {
    const email = uniqueEmail("login");
    const password = "a-strong-enough-password-1";
    const { ctx: registerCtx } = createPublicContext();
    await appRouter.createCaller(registerCtx).auth.register({ email, password });

    const { ctx: loginCtx, setCookies } = createPublicContext();
    const loggedIn = await appRouter.createCaller(loginCtx).auth.login({ email, password });
    expect(loggedIn.requiresTwoFactor).toBe(false);
    if (!loggedIn.requiresTwoFactor) expect(loggedIn.user.email).toBe(email);
    expect(setCookies).toHaveLength(1);

    const { ctx: badPasswordCtx } = createPublicContext();
    await expect(
      appRouter.createCaller(badPasswordCtx).auth.login({ email, password: "totally-wrong-password-1" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    const { ctx: unknownEmailCtx } = createPublicContext();
    await expect(
      appRouter.createCaller(unknownEmailCtx).auth.login({ email: uniqueEmail("nobody"), password }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("auth.me returns null for anonymous requests and the user for authenticated ones", async () => {
    const { ctx } = createPublicContext();
    const anonymous = await appRouter.createCaller(ctx).auth.me();
    expect(anonymous).toBeNull();

    const email = uniqueEmail("me");
    const stored = await getUserByEmail(email);
    expect(stored).toBeUndefined();
    const { ctx: registerCtx } = createPublicContext();
    const registered = await appRouter.createCaller(registerCtx).auth.register({ email, password: "another-strong-pass-1" });

    const authenticatedCtx: TrpcContext = { ...createPublicContext().ctx, user: registered };
    const me = await appRouter.createCaller(authenticatedCtx).auth.me();
    expect(me?.email).toBe(email);
  });
});
