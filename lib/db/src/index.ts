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

  // Supabase direct URLs (port 5432) use IPv6 which times out on Render IPv4 hosts.
  // Automatically rewrite to Supabase IPv4 Pooler (port 6543).
  if (url.includes("db.qnflaeexcmwwcabrcrhb.supabase.co")) {
    url = url.replace(
      "postgres:hatafrakshi@db.qnflaeexcmwwcabrcrhb.supabase.co:5432",
      "postgres.qnflaeexcmwwcabrcrhb:hatafrakshi@aws-0-ap-south-1.pooler.supabase.com:6543"
    ).replace(
      "postgres:hatafrakshi@db.qnflaeexcmwwcabrcrhb.supabase.co",
      "postgres.qnflaeexcmwwcabrcrhb:hatafrakshi@aws-0-ap-south-1.pooler.supabase.com:6543"
    );
  }

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
      // SSL for cloud DBs (CockroachDB, Neon, Supabase, Render, Vercel, etc.)
      ...(process.env.DATABASE_SSL === "false" || url.includes("ssl=false") || url.includes("localhost") || url.includes("127.0.0.1")
        ? {}
        : { ssl: { rejectUnauthorized: false } }),
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
