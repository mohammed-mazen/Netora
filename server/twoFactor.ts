// Two-Factor Authentication (RFC 6238 TOTP) — closes a real security gap
// identified during the competitive DevTools audit: apluswifi.com's Ziggy
// route registry exposes a full two-factor.* route group (login/confirm/
// enable/disable/qr-code/recovery-codes/secret-key), but Netora had NO
// equivalent before this module. This implementation goes further than the
// audited competitor by encrypting the TOTP secret at rest (AES-256-GCM,
// same scheme as server/secrets.ts) — the competitor's own Ziggy dump gives
// no evidence its secret storage is encrypted — and bcrypt-hashing every
// recovery code individually (each single-use, never re-shown).
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { twoFactorSecrets, users } from "../drizzle/schema";
import { getDb } from "./db";
import { encryptSecretValue, decryptSecretValue } from "./secrets";

const ISSUER = "Netora";
const RECOVERY_CODE_COUNT = 8;
const BCRYPT_ROUNDS = 10;

type RecoveryCodeRecord = { codeHash: string; usedAt: string | null };

function generateRecoveryCode(): string {
  // 10 uppercase alphanumeric chars, grouped for readability: XXXXX-XXXXX
  const raw = crypto.randomBytes(8).toString("hex").toUpperCase().slice(0, 10);
  return `${raw.slice(0, 5)}-${raw.slice(5, 10)}`;
}

/** Step 1: generate a new (unconfirmed) TOTP secret + provisioning QR code for the user. Does NOT enable 2FA yet. */
export async function beginTwoFactorSetup(input: { userId: number; userEmail: string }): Promise<{ secret: string; qrCodeDataUrl: string; recoveryCodes: string[] }> {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لإعداد التحقق بخطوتين");

  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: input.userEmail,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: new OTPAuth.Secret({ size: 20 }),
  });

  const secretBase32 = totp.secret.base32;
  const { ciphertext, iv, authTag } = encryptSecretValue(secretBase32);

  const recoveryCodes = Array.from({ length: RECOVERY_CODE_COUNT }, generateRecoveryCode);
  const hashedRecoveryCodes: RecoveryCodeRecord[] = await Promise.all(
    recoveryCodes.map(async code => ({ codeHash: await bcrypt.hash(code, BCRYPT_ROUNDS), usedAt: null })),
  );

  await db
    .insert(twoFactorSecrets)
    .values({
      userId: input.userId,
      secretCiphertext: ciphertext,
      secretIv: iv,
      secretAuthTag: authTag,
      recoveryCodes: JSON.stringify(hashedRecoveryCodes),
      confirmedAt: null,
    })
    .onDuplicateKeyUpdate({ set: { secretCiphertext: ciphertext, secretIv: iv, secretAuthTag: authTag, recoveryCodes: JSON.stringify(hashedRecoveryCodes), confirmedAt: null } });

  const qrCodeDataUrl = await QRCode.toDataURL(totp.toString());
  return { secret: secretBase32, qrCodeDataUrl, recoveryCodes };
}

async function loadDecryptedSecret(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  const row = (await db.select().from(twoFactorSecrets).where(eq(twoFactorSecrets.userId, userId)).limit(1))[0];
  if (!row) return null;
  const secretBase32 = decryptSecretValue({ ciphertext: row.secretCiphertext, iv: row.secretIv, authTag: row.secretAuthTag });
  return { row, secretBase32 };
}

function verifyTotpCode(secretBase32: string, code: string): boolean {
  const totp = new OTPAuth.TOTP({ issuer: ISSUER, algorithm: "SHA1", digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(secretBase32) });
  // window: 1 tolerates ±30s clock drift, matching common TOTP UX conventions.
  const delta = totp.validate({ token: code.replace(/\s/g, ""), window: 1 });
  return delta !== null;
}

/** Step 2: confirm setup by verifying one live TOTP code. Enables 2FA on the account only after this succeeds. */
export async function confirmTwoFactorSetup(input: { userId: number; code: string }): Promise<{ success: true }> {
  const loaded = await loadDecryptedSecret(input.userId);
  if (!loaded) throw new Error("لم يبدأ إعداد التحقق بخطوتين لهذا الحساب");
  if (loaded.row.confirmedAt) throw new Error("التحقق بخطوتين مُفعّل مسبقًا");
  if (!verifyTotpCode(loaded.secretBase32, input.code)) throw new Error("رمز التحقق غير صحيح");

  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  await db.update(twoFactorSecrets).set({ confirmedAt: new Date() }).where(eq(twoFactorSecrets.userId, input.userId));
  await db.update(users).set({ twoFactorEnabled: 1 }).where(eq(users.id, input.userId));
  return { success: true };
}

/** Verifies a login-time TOTP code OR a single-use recovery code (whichever matches first). Marks recovery codes used-once. */
export async function verifyTwoFactorChallenge(input: { userId: number; code: string }): Promise<{ success: boolean; usedRecoveryCode: boolean }> {
  const loaded = await loadDecryptedSecret(input.userId);
  if (!loaded || !loaded.row.confirmedAt) return { success: false, usedRecoveryCode: false };

  if (verifyTotpCode(loaded.secretBase32, input.code)) {
    return { success: true, usedRecoveryCode: false };
  }

  const recoveryCodes = JSON.parse(loaded.row.recoveryCodes) as RecoveryCodeRecord[];
  const normalizedInput = input.code.trim().toUpperCase();
  for (let i = 0; i < recoveryCodes.length; i++) {
    const entry = recoveryCodes[i];
    if (entry.usedAt) continue;
    // Recovery codes are bcrypt-hashed; we must check the plaintext input
    // against every unused hash since there is no direct lookup by value.
    // eslint-disable-next-line no-await-in-loop
    const matches = await bcrypt.compare(normalizedInput, entry.codeHash);
    if (matches) {
      recoveryCodes[i] = { ...entry, usedAt: new Date().toISOString() };
      const db = await getDb();
      if (db) await db.update(twoFactorSecrets).set({ recoveryCodes: JSON.stringify(recoveryCodes) }).where(eq(twoFactorSecrets.userId, input.userId));
      return { success: true, usedRecoveryCode: true };
    }
  }

  return { success: false, usedRecoveryCode: false };
}

/** Regenerates a fresh batch of recovery codes (invalidating the old batch entirely). Requires 2FA already confirmed. */
export async function regenerateRecoveryCodes(userId: number): Promise<string[]> {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  const loaded = await loadDecryptedSecret(userId);
  if (!loaded || !loaded.row.confirmedAt) throw new Error("التحقق بخطوتين غير مُفعّل لهذا الحساب");

  const recoveryCodes = Array.from({ length: RECOVERY_CODE_COUNT }, generateRecoveryCode);
  const hashedRecoveryCodes: RecoveryCodeRecord[] = await Promise.all(
    recoveryCodes.map(async code => ({ codeHash: await bcrypt.hash(code, BCRYPT_ROUNDS), usedAt: null })),
  );
  await db.update(twoFactorSecrets).set({ recoveryCodes: JSON.stringify(hashedRecoveryCodes) }).where(eq(twoFactorSecrets.userId, userId));
  return recoveryCodes;
}

/** Fully disables 2FA for the account (requires the caller to have already verified the current password). */
export async function disableTwoFactor(userId: number): Promise<{ success: true }> {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  await db.delete(twoFactorSecrets).where(eq(twoFactorSecrets.userId, userId));
  await db.update(users).set({ twoFactorEnabled: 0 }).where(eq(users.id, userId));
  return { success: true };
}

export async function getTwoFactorStatus(userId: number): Promise<{ enabled: boolean; confirmedAt: Date | null }> {
  const loaded = await loadDecryptedSecret(userId).catch(() => null);
  return { enabled: Boolean(loaded?.row.confirmedAt), confirmedAt: loaded?.row.confirmedAt ?? null };
}
