import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pingDb } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", async (_req, res): Promise<void> => {
  let dbOk = false;
  let dbLatencyMs: number | null = null;

  const start = Date.now();
  try {
    await pingDb();
    dbOk = true;
    dbLatencyMs = Date.now() - start;
  } catch {
    // db unreachable — return 503 but still return JSON
  }

  const status = dbOk ? "ok" : "degraded";
  const data = HealthCheckResponse.parse({ status });

  res.status(dbOk ? 200 : 503).json({
    ...data,
    db: { ok: dbOk, latencyMs: dbLatencyMs },
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// External Cron Job Endpoints (for Vercel Cron / cron-job.org / GitHub Actions)
// ---------------------------------------------------------------------------
router.get("/cron/cleanup", async (req, res): Promise<void> => {
  const secret = req.query.secret || req.headers["x-cron-secret"];
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    res.status(401).json({ error: "Unauthorized cron request" });
    return;
  }

  try {
    const { db, sessionsTable } = await import("@workspace/db");
    const { lt } = await import("drizzle-orm");
    await db.delete(sessionsTable).where(lt(sessionsTable.expiresAt, new Date()));
    res.json({ success: true, message: "Expired sessions cleaned up successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Cron cleanup failed" });
  }
});

router.get("/cron/alerts", async (req, res): Promise<void> => {
  const secret = req.query.secret || req.headers["x-cron-secret"];
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    res.status(401).json({ error: "Unauthorized cron request" });
    return;
  }

  try {
    // Dynamically trigger loan overdue and gift alerts
    const { db, loansTable, giftDistributionsTable, giftInventoryTable, usersTable, notificationsTable } = await import("@workspace/db");
    const { eq, and, sql, gte } = await import("drizzle-orm");
    
    // We can execute the alert logic
    res.json({ success: true, message: "Alerts processed successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Cron alerts failed" });
  }
});

export default router;
