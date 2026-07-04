import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------
app.use(
  helmet({
    // Allow inline scripts needed by the frontend in dev; tighten in production
    contentSecurityPolicy: process.env.NODE_ENV === "production",
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
      : true, // allow all origins when CORS_ORIGINS is not set (dev / behind reverse proxy)
    credentials: true,
  }),
);

// ---------------------------------------------------------------------------
// Request logging & body parsing
// ---------------------------------------------------------------------------
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
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

