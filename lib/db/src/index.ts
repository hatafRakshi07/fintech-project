import dns from "node:dns";
try {
  dns.setDefaultResultOrder("ipv4first");
} catch (e) {}

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index";

const { Pool } = pg;

// Supabase direct connection — rejectUnauthorized:false handles SSL in pool config
const NEON_DEFAULT_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:hatafrakshi@db.qnflaeexcmwwcabrcrhb.supabase.co:5432/postgres";

let poolInstance: pg.Pool | null = null;
let dbInstance: any = null;

function getPool() {
  let url = process.env.DATABASE_URL || NEON_DEFAULT_URL;

  // Strip sslmode from URL so pg-connection-string never overrides our ssl config.
  // (pg v8+ treats sslmode=require as verify-full, breaking rejectUnauthorized:false.)
  try {
    const u = new URL(url);
    u.searchParams.delete("sslmode");
    u.searchParams.delete("ssl");
    url = u.toString();
  } catch { /* non-standard URL — leave as-is */ }

  const isLocal = url.includes("localhost") || url.includes("127.0.0.1");

  if (!poolInstance) {
    poolInstance = new Pool({
      connectionString: url,
      // Production-grade pool settings
      max: parseInt(process.env.DB_POOL_MAX ?? "5", 10),
      min: 0,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
      ...(process.env.DATABASE_SSL === "false" || isLocal ? {} : { ssl: { rejectUnauthorized: false } }),
    } as any);

    poolInstance.on("connect", (client) => {
      client.query("SET search_path TO public;").catch(() => {});
    });

    // Log pool errors so they surface in prod logs instead of crashing
    poolInstance.on("error", (err) => {
      console.error("[pg-pool] Unexpected pool error", err.message);
    });
  }
  return poolInstance;
}

/** Drain the pool gracefully — call on SIGTERM/SIGINT. */
export async function closePool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
    dbInstance = null;
  }
}

/** Ping the DB — used by the health-check endpoint. */
export async function pingDb(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("SELECT 1");
  } finally {
    client.release();
  }
}

function getDb() {
  if (!dbInstance) {
    dbInstance = drizzle(getPool(), { schema });
  }
  return dbInstance;
}

export const pool: pg.Pool = new Proxy({} as pg.Pool, {
  get(target, prop, receiver) {
    if (prop === "then") return undefined;
    return Reflect.get(getPool(), prop, receiver);
  }
});

export const db: ReturnType<typeof drizzle<typeof schema>> = new Proxy({} as any, {
  get(target, prop, receiver) {
    if (prop === "then") return undefined;
    return Reflect.get(getDb(), prop, receiver);
  }
});

export * from "./schema/index";
