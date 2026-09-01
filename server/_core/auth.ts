// Independent authentication: local accounts (email + password), bcrypt
// password hashing, and JWT session cookies. Replaces the Manus/Genspark
// OAuth-based `sdk.ts` module. `authenticateRequest` keeps the exact same
// signature the rest of the app (server/_core/context.ts) already calls, so
// no other file needs to change to consume this module.
import { ForbiddenError } from "@shared/_core/errors";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import bcrypt from "bcryptjs";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const BCRYPT_SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export type SessionPayload = { userId: number };

class AuthService {
  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) return new Map<string, string>();
    return new Map(Object.entries(parseCookieHeader(cookieHeader)));
  }

  private getSessionSecret() {
    if (!ENV.cookieSecret) {
      throw new Error("JWT_SECRET is not configured — set it in the environment before starting the server");
    }
    return new TextEncoder().encode(ENV.cookieSecret);
  }

  /** Signs a session JWT carrying only the local numeric user id. `kind: "session"` distinguishes it from a short-lived 2FA challenge token signed with the same secret (see below), so a leaked challenge token can never be replayed as a full session cookie. */
  async createSessionToken(userId: number, options: { expiresInMs?: number } = {}): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return new SignJWT({ userId, kind: "session" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async verifySession(cookieValue: string | undefined | null): Promise<SessionPayload | null> {
    if (!cookieValue) return null;

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, { algorithms: ["HS256"] });
      const { userId, kind } = payload as Record<string, unknown>;
      if (typeof userId !== "number") {
        console.warn("[Auth] Session payload missing userId");
        return null;
      }
      // `kind` is absent on tokens signed before this field existed (backward
      // compatible), but if present it MUST be "session" — rejects a 2FA
      // challenge token being used directly as a session cookie.
      if (kind !== undefined && kind !== "session") {
        console.warn("[Auth] Rejected non-session token used as session cookie");
        return null;
      }
      return { userId };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }

  /** Step 1 of 2FA login: a short-lived (5 min), single-purpose token proving the password was already verified for this userId — NOT a valid session by itself (see `kind` check above). */
  async createTwoFactorChallengeToken(userId: number): Promise<string> {
    const secretKey = this.getSessionSecret();
    const expirationSeconds = Math.floor((Date.now() + 5 * 60_000) / 1000);
    return new SignJWT({ userId, kind: "2fa_challenge" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async verifyTwoFactorChallengeToken(token: string): Promise<{ userId: number } | null> {
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(token, secretKey, { algorithms: ["HS256"] });
      const { userId, kind } = payload as Record<string, unknown>;
      if (typeof userId !== "number" || kind !== "2fa_challenge") return null;
      return { userId };
    } catch (error) {
      console.warn("[Auth] 2FA challenge token verification failed", String(error));
      return null;
    }
  }

  async authenticateRequest(req: Request): Promise<User> {
    const cookies = this.parseCookies(req.headers.cookie);
    let sessionToken = cookies.get(COOKIE_NAME);

    // Fallback to the Authorization header for clients that cannot rely on
    // cookies (e.g. mobile webviews with strict cookie policies).
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }

    const session = await this.verifySession(sessionToken);
    if (!session) throw ForbiddenError("Invalid session cookie");

    const user = await db.getUserById(session.userId);
    if (!user) throw ForbiddenError("User not found");

    return user;
  }
}

export const auth = new AuthService();

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 320;
}

// Complexity policy (README "الخطوات التالية الموصى بها" #6): beyond the
// 8-200 length bound, require at least one letter (Latin or Arabic, since
// the UI is Arabic-first and this is a local-account password, not a
// username) AND at least one digit. This blocks pure-dictionary-word and
// pure-numeric passwords without forcing a punishing uppercase/symbol rule
// that would frustrate real ISP-operator users typing on a phone keyboard.
export function isValidPassword(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  if (value.length < 8 || value.length > 200) return false;
  const hasLetter = /[a-zA-Z\u0600-\u06FF]/.test(value);
  const hasDigit = /[0-9]/.test(value);
  return hasLetter && hasDigit;
}

// Re-exported for convenience so callers of this module (e.g. the auth
// router) don't need a second import from shared/const for the lockout
// policy values; the canonical definition lives in shared/const.ts to avoid
// a circular dependency with server/db.ts (see comment there).
export { ACCOUNT_LOCKOUT_THRESHOLD, ACCOUNT_LOCKOUT_DURATION_MS } from "@shared/const";
