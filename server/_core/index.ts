import "dotenv/config";
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
import { startBackgroundJobWorker } from "../worker/backgroundJobWorker";

// Rate limiter for the authentication endpoints (login/register are the only
// unauthenticated, credential-guessable tRPC procedures). Scoped to the
// tRPC path prefix rather than individual procedure names since Express
// routing happens before the tRPC router dispatches to a specific
// procedure; the tRPC batch link may also combine multiple calls into one
// HTTP request, so this intentionally rate-limits at the connection/IP
// level rather than per-procedure.
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20, // 20 attempts per IP per window is generous for real users, punishing for brute force
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "محاولات كثيرة جدًا، الرجاء المحاولة لاحقًا" },
});

// General-purpose limiter for the whole tRPC surface, much looser than the
// auth-specific one above — mainly a backstop against runaway clients/bots,
// not meant to constrain normal interactive usage (dashboards poll fairly
// frequently via react-query).
const apiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "عدد كبير جدًا من الطلبات، الرجاء الإبطاء" },
});

// RADIUS accounting is called directly by FreeRADIUS (or an exec/rlm_rest
// shim) for every Start/Interim-Update/Stop event across an entire ISP's
// customer base — this can legitimately be a high-volume endpoint, so its
// limit is generous and keyed the same way (by source IP, i.e. the
// FreeRADIUS server's IP), just high enough to absorb bursts of session
// churn while still bounding an attacker hammering the endpoint.
const radiusRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  limit: 1200,
  standardHeaders: true,
  legacyHeaders: false,
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

  // In production this process sits behind a reverse proxy (nginx/Caddy) for
  // TLS termination — without `trust proxy`, express-rate-limit (and any
  // future IP-based logic) would see the proxy's own loopback IP for every
  // request instead of the real client IP, making rate limiting useless.
  // TRUST_PROXY_HOPS lets an operator tune this to their exact proxy chain
  // depth (Express's recommended practice — see the security guidance in
  // express-rate-limit's own docs against blindly trusting X-Forwarded-For).
  // Defaults to 1 (a single reverse proxy in front of Node), matching the
  // documented single-VPS/PM2/nginx deployment layout in this README.
  const trustProxyHops = Number.parseInt(process.env.TRUST_PROXY_HOPS ?? "1", 10);
  app.set("trust proxy", Number.isFinite(trustProxyHops) ? trustProxyHops : 1);

  // Security headers (CSP relaxed for the SPA's inline runtime script + CDN
  // fonts/analytics it loads — see index.html; a strict default-src would
  // break the app). HSTS is left to the reverse proxy (nginx) since this
  // process itself does not terminate TLS.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );

  // Body size limits, scoped per-route instead of one generous global 50mb
  // limit for everything (a needless DoS surface — a 50mb limit applied to,
  // say, the login mutation lets an attacker force this process to buffer
  // 50mb per request for free). Each limit is sized to the largest
  // legitimate payload that route actually accepts:
  //   - /api/radius/accounting: a handful of small string/number fields from
  //     FreeRADIUS — a few KB at most, ever.
  //   - /api/trpc: the largest real payload is workspace.files.upload's
  //     `contentBase64` (schema-capped at 7,000,000 chars ~= 7MB), plus
  //     superjson/JSON framing overhead and tRPC batching of multiple calls
  //     in one request — 10mb comfortably covers that with headroom.
  //   - everything else (storage proxy, static assets): no body expected.
  app.use("/api/radius/accounting", radiusRateLimiter, express.json({ limit: "256kb" }));
  app.use("/api/trpc", express.json({ limit: "10mb" }), express.urlencoded({ limit: "10mb", extended: true }));

  registerStorageProxy(app);
  registerRadiusAccountingRoute(app);

  // tRPC API — a tight limiter on auth-shaped batch calls, a looser general
  // limiter on everything else under /api/trpc. Order matters: Express
  // matches middleware by registration order for a given path, so the
  // narrower auth check must run first.
  //
  // trpc's httpBatchLink can combine several procedure calls invoked in the
  // same tick into one HTTP request, joining their names with commas in the
  // URL (e.g. "/api/trpc/auth.login,auth.me"), so a plain exact-path check
  // would miss login/register calls that happen to be batched alongside
  // something else. This inspects every comma-separated segment of the last
  // path component instead of relying on Express's path-prefix matching.
  app.use("/api/trpc", (req, res, next) => {
    const lastSegment = req.path.split("/").pop() ?? "";
    const procedures = lastSegment.split(",");
    if (procedures.includes("auth.login") || procedures.includes("auth.register")) {
      return authRateLimiter(req, res, next);
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
  // development mode uses Vite, production mode uses static files
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

  // Background jobs (router health checks, RADIUS projections, etc.) run
  // in-process alongside the HTTP server. On a multi-instance VPS deployment
  // this should be split into a dedicated PM2 process (see ecosystem.config.cjs)
  // to avoid duplicate job processing.
  startBackgroundJobWorker();
}

startServer().catch(console.error);
