// [Replaced index.ts to include Redis Rate Limiting]
import express from "express";
import { createServer } from "http";
import net from "net";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStorageProxy } from "./storageProxy";
import { registerRadiusAccountingRoute } from "../radiusAccounting";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { startBackgroundJobWorker, stopBackgroundJobWorker } from "../worker/backgroundJobWorker";
import { getDb, connectionPool } from "../db";
import { handlePaymentWebhook } from "../webhooks/payments";
import { sql } from "drizzle-orm";
import { redisClient, ensureRedisConnected } from "../redis";
import RedisStore from "rate-limit-redis";
import { bgQueue, worker } from "../queue";

ensureRedisConnected();

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
  }),
  message: { error: "محاولات كثيرة جدًا، الرجاء المحاولة لاحقًا" },
});

const apiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
  }),
  message: { error: "عدد كبير جدًا من الطلبات، الرجاء الإبطاء" },
});

const tenantOperationsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
  }),
  message: { error: "عدد كبير جدًا من عمليات المؤسسة، الرجاء الإبطاء" },
});

const radiusRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  limit: 1200,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
  }),
  message: { accepted: false, error: "معدل طلبات RADIUS مرتفع جدًا" },
});

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  if (process.env.NODE_ENV === "production") {
    if (await isPortAvailable(startPort)) {
      return startPort;
    }
    throw new Error(`Port ${startPort} is already in use.`);
  }
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  const trustProxyHops = Number.parseInt(process.env.TRUST_PROXY_HOPS ?? "1", 10);
  app.set("trust proxy", Number.isFinite(trustProxyHops) ? trustProxyHops : 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );

  app.get("/health/liveness", (req, res) => res.json({ status: "ok" }));
  app.get("/health/readiness", async (req, res) => {
    try {
      const db = await getDb();
      if (!db) throw new Error("DB not ready");

      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2000));
      const dbPromise = db.execute(sql`SELECT 1`);
      await Promise.race([dbPromise, timeoutPromise]);

      res.json({ status: "ok" });
    } catch (e) {
      res.status(503).json({ status: "error", message: "Database unavailable" });
    }
  });

  app.post("/api/webhooks/payments", express.json({ limit: "1mb" }), handlePaymentWebhook);

  app.use("/api/radius/accounting", radiusRateLimiter, express.json({ limit: "256kb" }));
  app.use("/api/trpc", express.json({ limit: "10mb" }), express.urlencoded({ limit: "10mb", extended: true }));

  registerStorageProxy(app);
  registerRadiusAccountingRoute(app);

  app.use("/api/trpc", (req, res, next) => {
    const lastSegment = req.path.split("/").pop() ?? "";
    const procedures = lastSegment.split(",");
    if (procedures.includes("auth.login") || procedures.includes("auth.register")) {
      return authRateLimiter(req, res, next);
    }
    if (procedures.some(p => p.startsWith("tenant.") || p.startsWith("workspace."))) {
      return tenantOperationsLimiter(req, res, next);
    }
    return next();
  });
  app.use("/api/trpc", apiRateLimiter);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  startBackgroundJobWorker();

  const shutdown = async (signal: string) => {
    console.log(`\n[${signal}] Shutting down gracefully...`);
    stopBackgroundJobWorker();
    console.log('Background worker stopped.');
    await worker.close();
    server.close(async () => {
      console.log('HTTP server closed.');
      if (connectionPool) {
        console.log('Closing database connection pool...');
        await connectionPool.end();
        console.log('Database connection pool closed.');
      }
      if (redisClient.isOpen) {
        await redisClient.quit();
      }
      process.exit(0);
    });

    setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    shutdown('uncaughtException');
  });
}

startServer().catch(console.error);
