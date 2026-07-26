import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pingDb } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", async (_req, res): Promise<void> => {
  let dbOk = false;
  let dbLatencyMs: number | null = null;
  let dbInfo: any = null;

  const start = Date.now();
  try {
    const { pool } = await import("@workspace/db");
    const client = await pool.connect();
    try {
      const dbRes = await client.query("SELECT current_database(), current_user, (SELECT count(*) FROM customers)::int as customer_count");
      dbInfo = dbRes.rows[0];
      dbOk = true;
    } finally {
      client.release();
    }
    dbLatencyMs = Date.now() - start;
  } catch (err: any) {
    dbInfo = { error: err?.message || String(err) };
  }

  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? "ok" : "degraded",
    db: { ok: dbOk, latencyMs: dbLatencyMs, info: dbInfo },
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// External Cron Job Endpoints (for Vercel Cron / cron-job.org / GitHub Actions)
// ---------------------------------------------------------------------------
router.get("/cron/cleanup", async (req, res): Promise<void> => {
  res.json({ success: true, message: "Cron cleanup stub" });
});

router.get("/cron/alerts", async (req, res): Promise<void> => {
  res.json({ success: true, message: "Alerts processed successfully stub" });
});

export default router;
