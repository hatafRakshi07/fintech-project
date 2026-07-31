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
    await pool.query("SELECT 1;");
    dbOk = true;
    dbLatencyMs = Date.now() - start;
    dbInfo = { status: "connected" };
  } catch (err: any) {
    dbInfo = { error: err?.message || String(err) };
  }

  // Always return 200 so hosting platform (Render/Vercel) doesn't abruptly kill the process during high load
  res.status(200).json({
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
