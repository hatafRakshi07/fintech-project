import app from "./app";
// Trigger fresh redeploy
import { logger } from "./lib/logger";
import { closePool } from "@workspace/db";
import { startScheduler, stopScheduler } from "./lib/scheduler";

// ---------------------------------------------------------------------------
// Startup — validate required environment variables before binding
// ---------------------------------------------------------------------------
const REQUIRED_ENV: string[] = ["DATABASE_URL", "PORT"];

if (!process.env.VERCEL) {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`[startup] Missing required environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }
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
