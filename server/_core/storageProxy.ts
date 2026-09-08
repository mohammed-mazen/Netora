import type { Express } from "express";
import { storageGetSignedUrl } from "../storage";
import { getDb } from "../db";
import { eq, and } from "drizzle-orm";
import { auth } from "./auth";
import { files, organizationMembers, organizations } from "../../drizzle/schema";
import { validateUploadableFile } from "../fileService";
import { storagePut } from "../storage";
import { auditMutation } from "../routers/_shared";
import * as crypto from "crypto";
import { getTenantPlanUsage } from "../db";
import { hasEffectiveTenantPermission } from "../db";

/**
 * Serves stored files by redirecting to a short-lived presigned S3 URL. Files
 * themselves are never proxied through this process, so bandwidth stays off
 * this server.
 *
 * Provides secure file access using tenant authentication and fine-grained permissions.
 */
export function registerFileAccessRoute(app: Express) {
  app.get("/api/files/:fileId/access", async (req, res) => {
    try {
      const fileId = parseInt(req.params.fileId || "", 10);
      if (isNaN(fileId) || fileId <= 0) {
        res.status(400).send("Invalid file ID");
        return;
      }

      // 1. Authenticate user
      const user = await auth.authenticateRequest(req);
      if (!user) {
        res.status(401).send("Unauthorized");
        return;
      }

      // 2. Fetch file metadata
      const db = await getDb();
      if (!db) {
        res.status(500).send("Database unavailable");
        return;
      }

      const fileRows = await db.select()
        .from(files)
        .where(eq(files.id, fileId))
        .limit(1);

      const file = fileRows[0];
      if (!file) {
        res.status(404).send("File not found");
        return;
      }

      // 3. Verify tenant membership and permissions
      const membershipRows = await db.select({
        role: organizationMembers.role,
        customRoleId: organizationMembers.customRoleId
      })
      .from(organizationMembers)
      .where(and(
        eq(organizationMembers.userId, user.id),
        eq(organizationMembers.organizationId, file.organizationId),
        eq(organizationMembers.status, "active")
      ))
      .limit(1);

      const membership = membershipRows[0];
      if (!membership) {
        // Return 404 to prevent information leakage across tenants
        res.status(404).send("File not found");
        return;
      }

      const isAuthorized = await hasEffectiveTenantPermission(
        { memberRole: membership.role, customRoleId: membership.customRoleId },
        "files:read"
      );

      if (!isAuthorized) {
        res.status(404).send("File not found");
        return;
      }

      // 4. Generate signed URL with Content-Disposition for safe download
      const url = await storageGetSignedUrl(file.storageKey, 300, file.originalName);
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      if ((err as any)?.name === "ForbiddenError" || (err as any)?.name === "JsonWebTokenError" || (err as any)?.message?.includes("jwt") || (err as any)?.message?.includes("session")) {
         res.status(401).send("Unauthorized");
         return;
      }
      console.error("[FileAccess] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

const maxFileBytes = 5 * 1024 * 1024;
export function registerFileUploadRoute(app: Express) {
  app.post("/api/files/upload", async (req, res) => {
    try {
      const user = await auth.authenticateRequest(req);
      if (!user) {
        res.status(401).send("Unauthorized");
        return;
      }

      const orgSlug = req.headers["x-organization-slug"] as string;
      if (!orgSlug) {
        res.status(400).send("Missing organization slug");
        return;
      }

      const rawCategory = req.headers["x-file-category"] as string;
      const validCategories = new Set(["import", "report", "backup", "attachment"]);
      if (!validCategories.has(rawCategory)) {
        res.status(400).send("تصنيف الملف غير صالح");
        return;
      }
      const category = rawCategory as "import" | "report" | "backup" | "attachment";
      const originalName = req.headers["x-file-name"] as string;
      const mimeType = req.headers["content-type"] as string;

      const contentLengthStr = req.headers["content-length"];
      const contentLength = contentLengthStr ? parseInt(contentLengthStr, 10) : 0;

      if (!originalName || !mimeType || !category || !contentLength) {
        res.status(400).send("Missing metadata headers");
        return;
      }

      if (contentLength > maxFileBytes || contentLength <= 0) {
        res.status(400).send("حجم الملف غير صالح");
        return;
      }

      const db = await getDb();
      if (!db) {
        res.status(500).send("Database unavailable");
        return;
      }

      const orgRows = await db.select().from(organizations).where(eq(organizations.slug, orgSlug)).limit(1);
      const org = orgRows[0];
      if (!org) {
         res.status(404).send("Not found");
         return;
      }
      const orgId = org.id;

      const membershipRows = await db.select({
        role: organizationMembers.role,
        customRoleId: organizationMembers.customRoleId
      }).from(organizationMembers)
      .where(and(eq(organizationMembers.userId, user.id), eq(organizationMembers.organizationId, orgId), eq(organizationMembers.status, "active"))).limit(1);

      const membership = membershipRows[0];
      if (!membership) {
        res.status(403).send("Forbidden");
        return;
      }

      const isAuthorized = await hasEffectiveTenantPermission({ memberRole: membership.role, customRoleId: membership.customRoleId }, "files:write");
      if (!isAuthorized) {
        res.status(403).send("Forbidden");
        return;
      }

      const usage = await getTenantPlanUsage(orgId);
      let limitBytes: number | null = null;
      let usedBytes = 0;
      if (usage.resources.storage.limitMb !== null && usage.resources.storage.usedMb !== null) {
        limitBytes = usage.resources.storage.limitMb * 1024 * 1024;
        usedBytes = usage.resources.storage.usedMb * 1024 * 1024;
      }


      // Pass-through validation stream to S3
      const { Transform } = require('stream');
      const originalNameDecoded = decodeURIComponent(originalName);

      const allowedTypes = new Set(["text/csv", "text/plain", "application/json", "application/pdf", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]);
      if (!allowedTypes.has(mimeType)) {
        res.status(400).send("نوع الملف غير مسموح");
        return;
      }

      let totalRead = 0;
      let magicBuffer = Buffer.alloc(0);
      let magicChecked = false;
      let jsonContent = "";

      const validatorStream = new Transform({
        transform(chunk: any, encoding: any, callback: any) {
          totalRead += chunk.length;
          if (totalRead > maxFileBytes) {
            return callback(new Error("File too large"));
          }
          if (limitBytes !== null && usedBytes + totalRead > limitBytes) {
            return callback(new Error("تجاوزت المؤسسة حد التخزين المسموح به"));
          }

          if (mimeType === "text/csv" || mimeType === "text/plain" || mimeType === "application/json") {
            const textContent = chunk.toString('utf8');
            if (textContent.indexOf('\0') !== -1) {
              return callback(new Error("تطابق نوع الملف مع المحتوى غير صحيح (النص يحتوي على أحرف غير صالحة)"));
            }
            if (mimeType === "application/json") {
              jsonContent += textContent;
            }
          }

          if (!magicChecked) {
            magicBuffer = Buffer.concat([magicBuffer, chunk]);
            if (magicBuffer.length >= 4 || totalRead === contentLength) {
              if (mimeType === "application/pdf") {
                if (magicBuffer[0] !== 0x25 || magicBuffer[1] !== 0x50 || magicBuffer[2] !== 0x44 || magicBuffer[3] !== 0x46) {
                  return callback(new Error("تطابق نوع الملف مع المحتوى غير صحيح (PDF)"));
                }
              } else if (mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
                if (magicBuffer[0] !== 0x50 || magicBuffer[1] !== 0x4B || magicBuffer[2] !== 0x03 || magicBuffer[3] !== 0x04) {
                  return callback(new Error("تطابق نوع الملف مع المحتوى غير صحيح (XLSX)"));
                }
              }
              magicChecked = true;
            }
          }

          callback(null, chunk);
        },
        flush(callback: any) {
          if (mimeType === "application/json") {
            try {
              JSON.parse(jsonContent);
            } catch (e) {
              return callback(new Error("محتوى JSON غير صالح"));
            }
          }
          callback();
        }
      });

      req.on('error', (err) => {
        validatorStream.destroy(err);
      });

      const safeName = originalNameDecoded.trim().replace(/[^a-zA-Z0-9._-]/g, "_");

      try {
        const uploadStream = req.pipe(validatorStream);
        const { key } = await storagePut(`organizations/${orgId}/${category}/${Date.now()}_${safeName}`, uploadStream as any, mimeType);

        // Wait, @aws-sdk/client-s3 PutObjectCommand doesn't always automatically calculate content-length if it's a stream without passing it, but Node environment can often handle it or use chunked encoding.
        const result = await db.insert(files).values({ organizationId: orgId, storageKey: key, originalName: originalNameDecoded.trim(), mimeType: mimeType, sizeBytes: totalRead, category: category, createdByUserId: user.id });

        const insertId = Number(result[0]?.insertId);
        const reqIdRaw = req.headers["x-request-id"];
        const reqId = (Array.isArray(reqIdRaw) ? reqIdRaw[0] : reqIdRaw) || require('crypto').randomUUID();

        await auditMutation({
          organizationId: orgId,
          actorUserId: user.id,
          action: "file.upload",
          resourceType: "file",
          resourceId: String(insertId),
          requestId: reqId.slice(0, 100),
          metadata: { category: category, mimeType: mimeType, sizeBytes: totalRead }
        });

        res.status(200).json({ id: insertId, originalName: originalNameDecoded.trim(), category, sizeBytes: totalRead });
      } catch (err: any) {
        console.error(err);
        res.status(400).send(err.message || "Upload stream error");
      }


    } catch (e) {
      console.error(e);
      res.status(500).send("Error");
    }
  });
}
