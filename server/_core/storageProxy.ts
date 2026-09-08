import type { Express } from "express";
import { storageGetSignedUrl } from "../storage";
import { getDb } from "../db";
import { files, organizationMembers } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "./auth";
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
