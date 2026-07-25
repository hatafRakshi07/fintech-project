import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { rateLimit } from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Trust the first proxy hop (Replit, Vercel, nginx) so rate-limiters see real IPs
app.set("trust proxy", 1);

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
          "https://*.clerk.accounts.dev",
          "https://clerk.com",
          "https://*.clerk.com",
          "https://challenges.cloudflare.com",
          "https://*.cloudflare.com",
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "blob:", "https://*.clerk.com", "https://*.googleapis.com"],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        connectSrc: [
          "'self'",
          "https://*.googleapis.com",
          "https://*.firebaseio.com",
          "https://*.clerk.accounts.dev",
          "https://clerk.com",
          "https://*.clerk.com",
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
          "https://*.clerk.accounts.dev",
          "https://clerk.com",
          "https://*.clerk.com",
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
  message: { error: "Too many requests. Please slow down." },
  skip: (req) => req.path === "/api/healthz", // never rate-limit health checks
});
app.use("/api", globalLimiter);

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

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use("/api", router);

// ---------------------------------------------------------------------------
// Static frontend serving (production only)
// Serves the built bissi-app on / and collector-app on /collector
// ---------------------------------------------------------------------------
if (process.env.NODE_ENV === "production") {
  let bissiDist: string;
  let collectorDist: string;

  if (process.env.VERCEL) {
    bissiDist = resolve(process.cwd(), "artifacts/api-server/dist/public");
    collectorDist = resolve(process.cwd(), "artifacts/api-server/dist/collector");
  } else {
    const __serverDir = dirname(fileURLToPath(import.meta.url));
    bissiDist = resolve(__serverDir, "./public");
    collectorDist = resolve(__serverDir, "./collector");
  }

  // Collector app — must be registered before the root static handler
  app.use("/collector", express.static(collectorDist));
  app.get(/^\/collector(?:\/(.*))?$/, (_req, res) => res.sendFile(join(collectorDist, "index.html")));

  // Bissi main app
  app.use(express.static(bissiDist));
  app.get(/^\/(.*)$/, (_req, res) => res.sendFile(join(bissiDist, "index.html")));
}

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

