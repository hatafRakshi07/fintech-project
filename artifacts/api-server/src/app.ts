import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { rateLimit } from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import router from "./routes";
import { logger } from "./lib/logger";
import { getPoolStats } from "@workspace/db";

const app: Express = express();

// Disable ETag generation for API responses so server always returns 200 OK with full JSON (prevents 304 empty bodies)
app.disable("etag");

// Trust the first proxy hop (Replit, Vercel, nginx) so rate-limiters see real IPs
app.set("trust proxy", 1);

// Prevent browser/CDN caching of API responses
app.use("/api", (req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------
app.use(
  (helmet as any)({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://www.google.com/recaptcha/",
          "https://www.gstatic.com/",
          "https://*.firebaseapp.com",
          "https://*.googleapis.com",
          "https://challenges.cloudflare.com",
          "https://*.cloudflare.com",
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "blob:", "https://*.googleapis.com"],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        connectSrc: [
          "'self'",
          "https://*.googleapis.com",
          "https://*.firebaseio.com",
          "https://www.fast2sms.com",
          "https://2factor.in",
          "https://control.msg91.com",
          "https://*.supabase.co",
          "https://challenges.cloudflare.com",
          "https://*.cloudflare.com",
        ],
        frameSrc: [
          "'self'",
          "https://www.google.com/recaptcha/",
          "https://recaptcha.google.com/",
          "https://*.firebaseapp.com",
          "https://challenges.cloudflare.com",
          "https://*.cloudflare.com",
        ],
        workerSrc: ["'self'", "blob:"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, // allow fonts/images from same-origin in SPA
  }),
);

// ---------------------------------------------------------------------------
// CORS — restrict to configured origin(s) in production
// ---------------------------------------------------------------------------
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
  : [];

app.use(
  cors({
    origin: allowedOrigins.length > 0
      ? (origin, cb) => {
          if (!origin || allowedOrigins.includes(origin)) cb(null, true);
          else cb(new Error(`CORS: origin '${origin}' not allowed`));
        }
      : true,
    credentials: true,
  }),
);

// ---------------------------------------------------------------------------
// Request correlation ID — injected as X-Request-Id header + log field
// ---------------------------------------------------------------------------
app.use((req: Request, res: Response, next: NextFunction) => {
  const id = (req.headers["x-request-id"] as string | undefined) ?? randomUUID();
  (req as any).id = id;
  res.setHeader("X-Request-Id", id);
  next();
});

// ---------------------------------------------------------------------------
// Global API rate limiter (generous — just blocks sustained floods)
// Per-endpoint limiters (e.g. login) are tighter and defined in each route.
// ---------------------------------------------------------------------------
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute window
  max: parseInt(process.env.RATE_LIMIT_MAX ?? "300", 10),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: { error: "Too many requests. Please slow down." },
  skip: (req) => req.path === "/api/healthz", // never rate-limit health checks
});
app.use("/api", globalLimiter);

// ---------------------------------------------------------------------------
// Circuit breaker — shed load immediately when DB pool is saturated
// ---------------------------------------------------------------------------
const POOL_WAIT_THRESHOLD = parseInt(process.env.POOL_CIRCUIT_THRESHOLD ?? "8", 10);
app.use("/api", (req: Request, res: Response, next: NextFunction) => {
  if (req.path === "/healthz") return next();
  const { waiting } = getPoolStats();
  if (waiting > POOL_WAIT_THRESHOLD) {
    res.status(503).set("Retry-After", "5").json({ error: "Server busy, please retry in a few seconds." });
    return;
  }
  next();
});

// ---------------------------------------------------------------------------
// Request logging & body parsing
// ---------------------------------------------------------------------------
app.use(
  (pinoHttp as any)({
    logger,
    genReqId: (req: Request) => (req as any).id,
    serializers: {
      req(req: Request) {
        return { id: (req as any).id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res: Response) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use("/api", router);

// ---------------------------------------------------------------------------
// Static frontend serving (Render / Production)
// Serves the built bissi-app on / and collector-app on /collector
// ---------------------------------------------------------------------------
const cwd = process.cwd();
const __serverDir = dirname(fileURLToPath(import.meta.url));

const collectorDist = existsSync(resolve(cwd, "artifacts/api-server/dist/collector"))
  ? resolve(cwd, "artifacts/api-server/dist/collector")
  : existsSync(resolve(cwd, "artifacts/collector-app/dist"))
  ? resolve(cwd, "artifacts/collector-app/dist")
  : resolve(__serverDir, "./collector");

const bissiDist = existsSync(resolve(cwd, "artifacts/api-server/dist/public"))
  ? resolve(cwd, "artifacts/api-server/dist/public")
  : existsSync(resolve(cwd, "artifacts/bissi-app/dist"))
  ? resolve(cwd, "artifacts/bissi-app/dist")
  : resolve(__serverDir, "./public");

app.use("/collector", express.static(collectorDist));
app.use((req, res, next) => {
  if (req.path === "/collector" || req.path.startsWith("/collector/")) {
    const indexFile = join(collectorDist, "index.html");
    if (existsSync(indexFile)) {
      res.sendFile(indexFile);
      return;
    }
    res.status(404).send("Collector App build index.html not found");
    return;
  }
  next();
});

app.use(express.static(bissiDist));
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  const indexFile = join(bissiDist, "index.html");
  if (existsSync(indexFile)) {
    res.sendFile(indexFile);
    return;
  }
  next();
});

// ---------------------------------------------------------------------------
// Global error handler — must be last, must have 4 params
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  const message = err instanceof Error ? err.message : "Internal server error";
  const status = (err as { status?: number }).status ?? 500;

  // Never expose stack traces to clients in production
  if (process.env.NODE_ENV !== "production") {
    logger.error(err, "Unhandled error");
  } else {
    logger.error({ message, status }, "Unhandled error");
  }

  if (res.headersSent) return;
  res.status(status).json({ error: status < 500 ? message : "Internal server error" });
});

export default app;

