import fs from 'fs';

const proxyPath = 'server/_core/storageProxy.ts';
let proxyContent = fs.readFileSync(proxyPath, 'utf8');

// The reviewer mentioned: "The new upload endpoint checks the storage quota using the user-provided content-length header. A malicious user can send content-length: 1 to pass the quota check (if they have at least 1 byte of quota remaining) and then stream a full 5MB payload, bypassing the tenant's plan limit."

// To fix this, we need to enforce the quota check *during* the stream processing or right before uploading (but doing it inside the Transform stream is best).

const quotaOld = `      const usage = await getTenantPlanUsage(orgId);
      if (usage.resources.storage.limitMb !== null && usage.resources.storage.usedMb !== null) {
        const limitBytes = usage.resources.storage.limitMb * 1024 * 1024;
        const usedBytes = usage.resources.storage.usedMb * 1024 * 1024;
        if (usedBytes + contentLength > limitBytes) {
          res.status(400).send("تجاوزت المؤسسة حد التخزين المسموح به");
          return;
        }
      }`;

const quotaNew = `      const usage = await getTenantPlanUsage(orgId);
      let limitBytes: number | null = null;
      let usedBytes = 0;
      if (usage.resources.storage.limitMb !== null && usage.resources.storage.usedMb !== null) {
        limitBytes = usage.resources.storage.limitMb * 1024 * 1024;
        usedBytes = usage.resources.storage.usedMb * 1024 * 1024;
      }`;

proxyContent = proxyContent.replace(quotaOld, quotaNew);

const transformOld = `        transform(chunk: any, encoding: any, callback: any) {
          totalRead += chunk.length;
          if (totalRead > maxFileBytes) {
            return callback(new Error("File too large"));
          }`;

const transformNew = `        transform(chunk: any, encoding: any, callback: any) {
          totalRead += chunk.length;
          if (totalRead > maxFileBytes) {
            return callback(new Error("File too large"));
          }
          if (limitBytes !== null && usedBytes + totalRead > limitBytes) {
            return callback(new Error("تجاوزت المؤسسة حد التخزين المسموح به"));
          }`;

proxyContent = proxyContent.replace(transformOld, transformNew);
fs.writeFileSync(proxyPath, proxyContent);

// Fix 2: Add missing auditMutation back into the POST endpoint.
const auditImportAdd = `import { auditMutation } from "../db";\nimport { crypto } from "crypto";`;
proxyContent = proxyContent.replace(`import { storagePut } from "../storage";`, `import { storagePut } from "../storage";\n${auditImportAdd}`);

const auditCallOld = `        const result = await db.insert(files).values({ organizationId: orgId, storageKey: key, originalName: originalNameDecoded.trim(), mimeType: mimeType, sizeBytes: totalRead, category: category, createdByUserId: user.id });
        res.status(200).json({ id: Number(result[0]?.insertId), originalName: originalNameDecoded.trim(), category, sizeBytes: totalRead });`;

const auditCallNew = `        const result = await db.insert(files).values({ organizationId: orgId, storageKey: key, originalName: originalNameDecoded.trim(), mimeType: mimeType, sizeBytes: totalRead, category: category, createdByUserId: user.id });

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

        res.status(200).json({ id: insertId, originalName: originalNameDecoded.trim(), category, sizeBytes: totalRead });`;

proxyContent = proxyContent.replace(auditCallOld, auditCallNew);
fs.writeFileSync(proxyPath, proxyContent);
