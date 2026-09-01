import { and, desc, eq, like, or } from "drizzle-orm";
import { files } from "../drizzle/schema";
import { getDb } from "./db";
import { storageGetSignedUrl, storagePut } from "./storage";

const maxFileBytes = 5 * 1024 * 1024;
const allowedTypes = new Set(["text/csv", "text/plain", "application/json", "application/pdf", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]);

export type UploadableFileInput = { originalName: string; mimeType: string; contentBase64: string; category: "import" | "report" | "backup" | "attachment" };

export function validateUploadableFile(input: UploadableFileInput) {
  if (!input.originalName.trim() || input.originalName.length > 255 || /[\\/\0]/.test(input.originalName)) throw new Error("اسم الملف غير صالح");
  if (!allowedTypes.has(input.mimeType)) throw new Error("نوع الملف غير مسموح");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input.contentBase64)) throw new Error("ترميز الملف غير صالح");
  const bytes = Buffer.from(input.contentBase64, "base64");
  if (!bytes.length || bytes.length > maxFileBytes) throw new Error("حجم الملف يجب أن يكون بين 1 بايت و5 ميغابايت");
  return bytes;
}

export async function uploadTenantFile(input: UploadableFileInput & { organizationId: number; userId: number }) {
  const bytes = validateUploadableFile(input);
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لحفظ ملف المؤسسة");
  const safeName = input.originalName.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
  const { key } = await storagePut(`organizations/${input.organizationId}/${input.category}/${Date.now()}_${safeName}`, bytes, input.mimeType);
  const result = await db.insert(files).values({ organizationId: input.organizationId, storageKey: key, originalName: input.originalName.trim(), mimeType: input.mimeType, sizeBytes: bytes.length, category: input.category, createdByUserId: input.userId });
  return { id: Number(result[0]?.insertId), originalName: input.originalName.trim(), category: input.category, sizeBytes: bytes.length };
}

export async function listTenantFiles(organizationId: number, options: { limit?: number; offset?: number; search?: string; category?: "import" | "report" | "backup" | "attachment" } = {}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لقراءة ملفات المؤسسة");
  const terms = options.search?.trim().slice(0, 120);
  const searchCondition = terms ? or(like(files.originalName, `%${terms}%`), like(files.mimeType, `%${terms}%`)) : undefined;
  const conditions = searchCondition && options.category ? and(eq(files.organizationId, organizationId), eq(files.category, options.category), searchCondition) : searchCondition ? and(eq(files.organizationId, organizationId), searchCondition) : options.category ? and(eq(files.organizationId, organizationId), eq(files.category, options.category)) : eq(files.organizationId, organizationId);
  const result = await db.select({ id: files.id, storageKey: files.storageKey, originalName: files.originalName, mimeType: files.mimeType, sizeBytes: files.sizeBytes, category: files.category, createdAt: files.createdAt })
    .from(files).where(conditions).orderBy(desc(files.createdAt)).limit(Math.min(Math.max(options.limit ?? 25, 1), 100)).offset(Math.max(options.offset ?? 0, 0));
  return result.map(({ storageKey: _storageKey, ...file }) => file);
}

export async function getTenantFileAccessUrl(input: { organizationId: number; fileId: number }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لفتح ملف المؤسسة");
  const result = await db.select({ id: files.id, originalName: files.originalName, storageKey: files.storageKey }).from(files)
    .where(and(eq(files.id, input.fileId), eq(files.organizationId, input.organizationId))).limit(1);
  if (!result[0]) throw new Error("الملف المحدد لا يتبع للمؤسسة");
  return { id: result[0].id, originalName: result[0].originalName, url: await storageGetSignedUrl(result[0].storageKey) };
}
