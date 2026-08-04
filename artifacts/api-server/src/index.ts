import dns from "node:dns";
try {
  dns.setDefaultResultOrder("ipv4first");
} catch (e) {}

import app from "./app";
import { logger } from "./lib/logger";
import { closePool, warmupDb } from "@workspace/db";
import { startScheduler, stopScheduler } from "./lib/scheduler";

// Default Neon fallback (IPv4, Render-accessible pooler endpoint).
const NEON_URL =
  "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb";

// Force Neon when DATABASE_URL is absent or points to direct Supabase host (.supabase.co:5432).
// Allows Supabase POOLER connection strings (*.pooler.supabase.com or port 6543).
const dbUrl = process.env.DATABASE_URL || "";
const isSupabaseDirect = dbUrl.includes('.supabase.co') && !dbUrl.includes('pooler.supabase.com') && !dbUrl.includes(':6543');
// Also force Neon if DATABASE_URL is empty or is the Supabase pooler that is now offline
if (!dbUrl || isSupabaseDirect || dbUrl.includes('supabase')) {
  process.env.DATABASE_URL = NEON_URL;
}

if (!process.env.PORT) {
  process.env.PORT = "5001";
}

const rawPort = process.env["PORT"];

if (!process.env.VERCEL) {
  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  const server = app.listen(port, (err?: Error) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port, env: process.env.NODE_ENV ?? "development" }, "Server listening");

    // Start hourly alert scheduler after server is ready
    startScheduler();

    // Trigger DB pool warm-up on boot
    warmupDb().catch((wErr) => {
      logger.error({ err: wErr }, "Database warmup ping error");
    });
  });

  // ---------------------------------------------------------------------------
  // Graceful shutdown — drain in-flight requests then release DB pool
  // ---------------------------------------------------------------------------
  let shuttingDown = false;

  async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "Shutdown signal received, closing server…");

    server.close(async () => {
      logger.info("HTTP server closed");
      stopScheduler();
      try {
        await closePool();
        logger.info("DB pool closed");
      } catch (err) {
        logger.error({ err }, "Error closing DB pool");
      }
      process.exit(0);
    });

    // Force-kill after 10 s if graceful drain takes too long
    setTimeout(() => {
      logger.error("Graceful shutdown timed out — forcing exit");
      process.exit(1);
    }, 10_000).unref();
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT",  () => shutdown("SIGINT"));

  // Surface unhandled rejections so they appear in logs
  process.on("unhandledRejection", (reason) => {
    logger.error({ reason }, "Unhandled promise rejection");
  });
  process.on("uncaughtException", (err) => {
    logger.error({ err }, "Uncaught exception — exiting");
    process.exit(1);
  });
}

export default app;
