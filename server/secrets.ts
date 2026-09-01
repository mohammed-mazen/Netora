// AES-256-GCM encryption for integration credentials (MikroTik password/API
// key, RADIUS shared secret). The key never touches the database — only
// SECRET_ENCRYPTION_KEY (a 32-byte key, base64 or hex encoded) does, supplied
// via environment variable on the VPS. Ciphertext/iv/authTag are stored in
// the `integration_secrets` table; `secretRef` values only ever reference a
// row by organization+kind, they never carry the secret itself.
import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { integrationSecrets, routerCredentials } from "../drizzle/schema";
import { getDb } from "./db";

const ALGORITHM = "aes-256-gcm";

function loadEncryptionKey(): Buffer {
  const raw = process.env.SECRET_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("SECRET_ENCRYPTION_KEY is not configured — required to store/read integration secrets");
  }
  // Accept either 32-byte hex (64 chars) or base64.
  const buf = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error("SECRET_ENCRYPTION_KEY must decode to exactly 32 bytes (hex-64 or base64)");
  }
  return buf;
}

function encrypt(plaintext: string): { ciphertext: string; iv: string; authTag: string } {
  const key = loadEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"), authTag: authTag.toString("base64") };
}

function decrypt(input: { ciphertext: string; iv: string; authTag: string }): string {
  const key = loadEncryptionKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(input.iv, "base64"));
  decipher.setAuthTag(Buffer.from(input.authTag, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(input.ciphertext, "base64")), decipher.final()]);
  return plaintext.toString("utf8");
}

// Generic AES-256-GCM helpers reused by server/twoFactor.ts to encrypt TOTP
// secrets under the SAME SECRET_ENCRYPTION_KEY (no second key to manage),
// without exposing integration-specific table coupling to that module.
export const encryptSecretValue = encrypt;
export const decryptSecretValue = decrypt;

export function buildSecretRef(organizationId: number, kind: "radius" | "mikrotik" | "sms" | "payment"): string {
  return `secret://integration/${organizationId}/${kind}`;
}

/** Stores (or replaces) the raw secret value for an organization's integration. Returns the resulting secretRef. */
export async function setIntegrationSecret(input: { organizationId: number; kind: "radius" | "mikrotik" | "sms" | "payment"; value: string }): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لحفظ السر");
  if (!input.value.trim()) throw new Error("قيمة السر مطلوبة");

  const { ciphertext, iv, authTag } = encrypt(input.value);
  await db
    .insert(integrationSecrets)
    .values({ organizationId: input.organizationId, kind: input.kind, ciphertext, iv, authTag })
    .onDuplicateKeyUpdate({ set: { ciphertext, iv, authTag } });

  return buildSecretRef(input.organizationId, input.kind);
}

/** Resolves a `secret://integration/{orgId}/{kind}` ref back to its plaintext value. Server-side (worker) use only. */
export async function resolveIntegrationSecret(secretRef: string): Promise<string | null> {
  const match = /^secret:\/\/integration\/(\d+)\/(radius|mikrotik|sms|payment)$/.exec(secretRef);
  if (!match) return null;
  const organizationId = Number(match[1]);
  const kind = match[2] as "radius" | "mikrotik" | "sms" | "payment";

  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة السر");

  const result = await db
    .select({ ciphertext: integrationSecrets.ciphertext, iv: integrationSecrets.iv, authTag: integrationSecrets.authTag })
    .from(integrationSecrets)
    .where(and(eq(integrationSecrets.organizationId, organizationId), eq(integrationSecrets.kind, kind)))
    .limit(1);

  if (!result[0]) return null;
  return decrypt(result[0]);
}

export type RouterCredential = { username: string; password: string };

export function buildRouterSecretRef(routerId: number): string {
  return `secret://router/${routerId}`;
}

/** Stores (or replaces) a router's management username+password/API key. Returns the resulting secretRef. */
export async function setRouterCredential(routerId: number, credential: RouterCredential): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لحفظ بيانات اعتماد الراوتر");
  if (!credential.username.trim() || !credential.password) throw new Error("اسم المستخدم وكلمة المرور مطلوبان");

  const { ciphertext, iv, authTag } = encrypt(JSON.stringify(credential));
  await db
    .insert(routerCredentials)
    .values({ routerId, ciphertext, iv, authTag })
    .onDuplicateKeyUpdate({ set: { ciphertext, iv, authTag } });

  return buildRouterSecretRef(routerId);
}

/** Resolves a `secret://router/{routerId}` ref back to the router's plaintext credentials. Server-side (worker) use only. */
export async function resolveRouterCredential(secretRef: string | null | undefined): Promise<RouterCredential | null> {
  if (!secretRef) return null;
  const match = /^secret:\/\/router\/(\d+)$/.exec(secretRef);
  if (!match) return null;
  const routerId = Number(match[1]);

  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة بيانات اعتماد الراوتر");

  const result = await db
    .select({ ciphertext: routerCredentials.ciphertext, iv: routerCredentials.iv, authTag: routerCredentials.authTag })
    .from(routerCredentials)
    .where(eq(routerCredentials.routerId, routerId))
    .limit(1);

  if (!result[0]) return null;
  try {
    return JSON.parse(decrypt(result[0])) as RouterCredential;
  } catch {
    return null;
  }
}
