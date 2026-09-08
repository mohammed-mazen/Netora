import { describe, expect, it, beforeAll, afterAll } from "vitest";
import express from "express";
import type { Server } from "http";
import { registerFileAccessRoute } from "./_core/storageProxy";
import { getDb } from "./db";
import { ENV } from "./_core/env";
import { files, organizations, users, organizationMembers } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { auth } from "./_core/auth";

describe("GET /api/files/:fileId/access", () => {
  let app: express.Express;
  let server: Server;
  let db: any;
  let baseUrl: string;
  let testUser1: any, testUser2: any;
  let testOrg1: any, testOrg2: any;
  let testFile1: any, testFile2: any;
  let cookie1: string, cookie2: string;

  beforeAll(async () => {
    process.env.S3_ENDPOINT = "http://test-s3";
    process.env.S3_ACCESS_KEY_ID = "test";
    process.env.S3_SECRET_ACCESS_KEY = "test";
    process.env.S3_BUCKET = "test-bucket";
    ENV.s3Endpoint = "http://test-s3";
    ENV.s3AccessKeyId = "test";
    ENV.s3SecretAccessKey = "test";
    ENV.s3Bucket = "test-bucket";
    app = express();
    registerFileAccessRoute(app);
    db = await getDb();

    // 1. Create users
    const [u1Result] = await db.insert(users).values({ name: "U1", email: `u1-${Date.now()}@test.local`, passwordHash: "x", timezone: "UTC" });
    const [u2Result] = await db.insert(users).values({ name: "U2", email: `u2-${Date.now()}@test.local`, passwordHash: "x", timezone: "UTC" });
    testUser1 = { id: Number(u1Result.insertId) };
    testUser2 = { id: Number(u2Result.insertId) };

    // 2. Create orgs
    const [o1Result] = await db.insert(organizations).values({ name: "O1", slug: "o1-test-" + Date.now(), status: "active", timezone: "UTC", currency: "SAR" });
    const [o2Result] = await db.insert(organizations).values({ name: "O2", slug: "o2-test-" + Date.now(), status: "active", timezone: "UTC", currency: "SAR" });
    testOrg1 = { id: Number(o1Result.insertId) };
    testOrg2 = { id: Number(o2Result.insertId) };

    // 3. Create memberships
    await db.insert(organizationMembers).values({ organizationId: testOrg1.id, userId: testUser1.id, role: "owner", status: "active" });
    await db.insert(organizationMembers).values({ organizationId: testOrg2.id, userId: testUser2.id, role: "support", status: "active" });

    // 4. Create files
    const [f1Result] = await db.insert(files).values({ organizationId: testOrg1.id, storageKey: "k1", originalName: "1.pdf", mimeType: "application/pdf", sizeBytes: 100, category: "attachment" });
    const [f2Result] = await db.insert(files).values({ organizationId: testOrg2.id, storageKey: "k2", originalName: "2.pdf", mimeType: "application/pdf", sizeBytes: 100, category: "attachment" });
    testFile1 = { id: Number(f1Result.insertId) };
    testFile2 = { id: Number(f2Result.insertId) };

    // 5. Generate cookies
    const authService = (auth as any);
    const token1 = await authService.createSessionToken(testUser1.id);
    const token2 = await authService.createSessionToken(testUser2.id);
    cookie1 = `app_session_id=${token1}`;
    cookie2 = `app_session_id=${token2}`;

    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        const port = typeof addr === "object" && addr ? addr.port : 0;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  async function fetchAccess(fileId: number, cookieHeader?: string) {
    const headers: Record<string, string> = {};
    if (cookieHeader) headers["Cookie"] = cookieHeader;
    return fetch(`${baseUrl}/api/files/${fileId}/access`, {
      method: "GET",
      headers,
      redirect: "manual", // Prevent following the 307 redirect
    });
  }

  it("Unauthenticated access => 401", async () => {
    const res = await fetchAccess(testFile1.id);
    expect(res.status).toBe(401);
  });

  it("Tenant A accessing Tenant B file => 404 with no leakage", async () => {
    const res = await fetchAccess(testFile2.id, cookie1);
    expect(res.status).toBe(404);
  });

  it("Support without files:read => 404", async () => {
    const res = await fetchAccess(testFile2.id, cookie2);
    expect(res.status).toBe(404);
  });

  it("Valid owner => short-lived authorized URL (307 redirect)", async () => {
    const res = await fetchAccess(testFile1.id, cookie1);
    expect(res.status).toBe(307);
    const location = res.headers.get("Location") || res.headers.get("location");
    expect(location).toContain("k1"); // S3 URL includes the key
  });

  it("Unknown file => 404", async () => {
    const res = await fetchAccess(9999999, cookie1);
    expect(res.status).toBe(404);
  });
});
