import dns from "node:dns";
try {
  dns.setDefaultResultOrder("ipv4first");
} catch (e) {}

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index";

const { Pool } = pg;

const NEON_DEFAULT_URL = "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require";

let poolInstance: pg.Pool | null = null;
let dbInstance: any = null;

function getPool() {
  let url = process.env.DATABASE_URL || NEON_DEFAULT_URL;
  if (url.includes("supabase.co:5432")) {
    url = NEON_DEFAULT_URL;
  }

  if (!poolInstance) {
    poolInstance = new Pool({
      connectionString: url,
      // Force public schema to prevent collisions with Supabase internal auth.users table
      options: "-c search_path=public",
      // Production-grade pool settings
      max: parseInt(process.env.DB_POOL_MAX ?? "10", 10),
      min: parseInt(process.env.DB_POOL_MIN ?? "1", 10),
      idleTimeoutMillis: 30_000,           // release idle clients after 30s
      connectionTimeoutMillis: 10_000,     // fail fast if DB is unreachable
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
