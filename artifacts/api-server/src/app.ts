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
import { getPoolStats, pool } from "@workspace/db";

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
// V2 Schema auto-migration — creates new tables if they don't exist
// Runs once on startup, idempotent, never drops existing data
// ---------------------------------------------------------------------------
async function runV2Migration(): Promise<void> {
  try {
    await pool.query(`
      DO $$ BEGIN CREATE TYPE payment_module AS ENUM ('BISSI','MONTHLY_INSTALLMENT','BYAJ','LOAN','DAILY_DIARY','OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN CREATE TYPE account_status AS ENUM ('ACTIVE','COMPLETED','PAUSED','DEFAULTED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN CREATE TYPE pay_mode AS ENUM ('CASH','UPI','BANK_TRANSFER','CHEQUE','ADJUSTMENT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN CREATE TYPE loan_stage AS ENUM ('APPLIED','APPROVED','DISBURSED','REPAYING','CLOSED','DEFAULTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await pool.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS reference_mobile VARCHAR(30)`);
    await pool.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_type VARCHAR(30) DEFAULT 'BISSI'`);
    await pool.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS display_id VARCHAR(20)`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS mi_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id TEXT NOT NULL,
        excel_token_label TEXT, token_serial INTEGER,
        installment_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        due_day SMALLINT, start_date DATE, complete_date DATE,
        address TEXT, notes TEXT,
        status account_status NOT NULL DEFAULT 'ACTIVE',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS mi_payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES mi_accounts(id) ON DELETE RESTRICT,
        customer_id TEXT NOT NULL,
        period_month DATE NOT NULL, payment_date DATE NOT NULL,
        amount NUMERIC(12,2) NOT NULL, payment_mode pay_mode NOT NULL DEFAULT 'CASH',
        receipt_number VARCHAR(100), collector VARCHAR(100), notes TEXT, raw_value TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(account_id, period_month)
      );
      CREATE TABLE IF NOT EXISTS byaj_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id TEXT NOT NULL,
        byaj_serial INTEGER, interest_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        due_day SMALLINT, address TEXT, reason1 TEXT, reason2 TEXT, reply TEXT, notes TEXT,
        status account_status NOT NULL DEFAULT 'ACTIVE', next_due_date DATE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS byaj_payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES byaj_accounts(id) ON DELETE RESTRICT,
        customer_id TEXT NOT NULL,
        period_month DATE NOT NULL, payment_date DATE NOT NULL,
        amount NUMERIC(12,2) NOT NULL, payment_mode pay_mode NOT NULL DEFAULT 'CASH',
        receipt_number VARCHAR(100), collector VARCHAR(100), notes TEXT, raw_value TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(account_id, period_month)
      );
      CREATE TABLE IF NOT EXISTS loan_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id TEXT NOT NULL,
        principal_amount NUMERIC(14,2) NOT NULL, disbursed_amount NUMERIC(14,2),
        interest_rate_pct NUMERIC(6,3) NOT NULL DEFAULT 0, tenure_months SMALLINT,
        disbursal_date DATE, expected_close_date DATE,
        security TEXT, guarantor_name TEXT, guarantor_mobile VARCHAR(20),
        stage loan_stage NOT NULL DEFAULT 'APPLIED', notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS loan_payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        loan_id UUID NOT NULL REFERENCES loan_accounts(id) ON DELETE RESTRICT,
        customer_id TEXT NOT NULL,
        payment_date DATE NOT NULL, total_paid NUMERIC(12,2) NOT NULL,
        principal_paid NUMERIC(12,2) NOT NULL DEFAULT 0, interest_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
        penalty_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
        payment_mode pay_mode NOT NULL DEFAULT 'CASH',
        receipt_number VARCHAR(100), collector VARCHAR(100), notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS payment_ledger (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id TEXT,
        module payment_module NOT NULL, source_id UUID, source_table VARCHAR(60),
        amount NUMERIC(12,2) NOT NULL, payment_mode pay_mode NOT NULL DEFAULT 'CASH',
        payment_date DATE NOT NULL, period_month DATE,
        collector VARCHAR(100), office_name VARCHAR(100), notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_mi_acc_customer  ON mi_accounts(customer_id);
      CREATE INDEX IF NOT EXISTS idx_mi_pay_customer  ON mi_payments(customer_id);
      CREATE INDEX IF NOT EXISTS idx_mi_pay_period    ON mi_payments(period_month);
      CREATE INDEX IF NOT EXISTS idx_byaj_acc_customer ON byaj_accounts(customer_id);
      CREATE INDEX IF NOT EXISTS idx_byaj_pay_customer ON byaj_payments(customer_id);
      CREATE INDEX IF NOT EXISTS idx_byaj_pay_period  ON byaj_payments(period_month);
      CREATE INDEX IF NOT EXISTS idx_loan_acc_customer ON loan_accounts(customer_id);
      CREATE INDEX IF NOT EXISTS idx_ledger_module    ON payment_ledger(module);
      CREATE INDEX IF NOT EXISTS idx_ledger_date      ON payment_ledger(payment_date);
    `);

    await pool.query(`
      CREATE OR REPLACE VIEW v2_dashboard_today AS
      SELECT module, COUNT(*)::int AS payment_count, SUM(amount)::numeric AS total_amount,
             SUM(CASE WHEN payment_mode='CASH' THEN amount ELSE 0 END)::numeric AS cash_amount,
             SUM(CASE WHEN payment_mode!='CASH' THEN amount ELSE 0 END)::numeric AS online_amount
      FROM payment_ledger WHERE payment_date=CURRENT_DATE GROUP BY module;

      CREATE OR REPLACE VIEW v2_dashboard_month AS
      SELECT module, DATE_TRUNC('month',payment_date)::date AS month,
             COUNT(*)::int AS payment_count, SUM(amount)::numeric AS total_amount
      FROM payment_ledger
      WHERE DATE_TRUNC('month',payment_date)=DATE_TRUNC('month',CURRENT_DATE)
      GROUP BY module, DATE_TRUNC('month',payment_date);

      CREATE OR REPLACE VIEW v2_mi_pending AS
      SELECT ma.id AS account_id, ma.customer_id, ma.installment_amount, ma.due_day,
             ma.excel_token_label, ma.token_serial,
             NOT EXISTS (SELECT 1 FROM mi_payments mp WHERE mp.account_id=ma.id
               AND mp.period_month=DATE_TRUNC('month',CURRENT_DATE)::date) AS is_pending
      FROM mi_accounts ma WHERE ma.status='ACTIVE';

      CREATE OR REPLACE VIEW v2_byaj_pending AS
      SELECT ba.id AS account_id, ba.customer_id, ba.interest_amount, ba.due_day, ba.byaj_serial,
             NOT EXISTS (SELECT 1 FROM byaj_payments bp WHERE bp.account_id=ba.id
               AND bp.period_month=DATE_TRUNC('month',CURRENT_DATE)::date) AS is_pending
      FROM byaj_accounts ba WHERE ba.status='ACTIVE';
    `);

    logger.info("V2 schema migration applied (idempotent)");
  } catch (err: any) {
    logger.warn({ err: err.message }, "V2 schema migration warning (non-fatal)");
  }
}

// Run migration async — don't block server startup
runV2Migration().catch(() => {});

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

