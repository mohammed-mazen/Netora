import type { Express } from "express";
import { storageGetSignedUrl } from "../storage";

/**
 * Serves stored files by redirecting to a short-lived presigned S3 URL. Files
 * themselves are never proxied through this process, so bandwidth stays off
 * this server. This is kept separate from `fileService.ts`'s tenant-scoped
 * `getTenantFileAccessUrl` because some historical stored `url` values may
 * still point at `/api/storage/{key}` directly.
 */
export function registerStorageProxy(app: Express) {
  app.get("/api/storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    try {
      const url = await storageGetSignedUrl(key);
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
