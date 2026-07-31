import dns from "node:dns";
try {
  dns.setDefaultResultOrder("ipv4first");
} catch (e) {}

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index";

const { Pool } = pg;

// Neon (IPv4, Render-accessible pooler endpoint). Supabase direct URL is IPv6-only and times out on Render.
const NEON_DEFAULT_URL =
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb";

let poolInstance: pg.Pool | null = null;
let dbInstance: any = null;

function getPool(): pg.Pool {
  let url = process.env.DATABASE_URL || NEON_DEFAULT_URL;

  // Auto-convert direct Neon host to Neon PgBouncer pooler host if needed
  if (url.includes(".neon.tech") && !url.includes("-pooler")) {
    url = url.replace(/([a-z0-9-]+)(\.[a-z0-9-]+\.aws\.neon\.tech)/i, "$1-pooler$2");
  }

  // Auto-convert direct Supabase host (db.[ref].supabase.co:5432) to IPv4 Pooler (aws-0-ap-south-1.pooler.supabase.com:6543)
  const supabaseMatch = url.match(/postgres(?::([^@]+))?@db\.([a-z0-9]+)\.supabase\.co/i);
  if (supabaseMatch) {
    const password = supabaseMatch[1] ? `:${supabaseMatch[1]}` : "";
    const projectRef = supabaseMatch[2];
    url = url.replace(
      `postgres${password}@db.${projectRef}.supabase.co:5432`,
      `postgres.${projectRef}${password}@aws-0-ap-south-1.pooler.supabase.com:6543`
    ).replace(
      `postgres${password}@db.${projectRef}.supabase.co`,
      `postgres.${projectRef}${password}@aws-0-ap-south-1.pooler.supabase.com:6543`
    );
  }

  let hostname = "";
  // Strip sslmode from URL so pg-connection-string never overrides our ssl config.
  // (pg v8+ treats sslmode=require as verify-full, breaking rejectUnauthorized:false.)
  try {
    const u = new URL(url);
    hostname = u.hostname;
    u.searchParams.delete("sslmode");
    u.searchParams.delete("ssl");

    if (u.hostname.includes(".neon.tech")) {
      const endpointId = u.hostname.split(".")[0];
      if (!u.searchParams.has("options") || !u.searchParams.get("options")?.includes("endpoint=")) {
        const existingOptions = u.searchParams.get("options");
        const newOptions = existingOptions
          ? `${existingOptions} endpoint=${endpointId}`
          : `endpoint=${endpointId}`;
        u.searchParams.set("options", newOptions);
      }
    }
    url = u.toString();
  } catch { /* non-standard URL — leave as-is */ }

  const isLocal = url.includes("localhost") || url.includes("127.0.0.1");

  if (!poolInstance) {
    poolInstance = new Pool({
      connectionString: url,
      // Production-grade pool settings
      max: parseInt(process.env.DB_POOL_MAX ?? "15", 10),
      min: 2,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 15_000,
      // prevent runaway queries from holding connections indefinitely
      statement_timeout: 30_000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
      ...(process.env.DATABASE_SSL === "false" || isLocal
        ? {}
        : { ssl: { rejectUnauthorized: false, ...(hostname ? { servername: hostname } : {}) } }),
    } as pg.PoolConfig);

    poolInstance.on("connect", (client: pg.PoolClient) => {
      client.query("SET search_path TO public;").catch(() => {});
    });

    // Log pool errors so they surface in prod logs instead of crashing
    poolInstance.on("error", (err: Error) => {
      console.error("[pg-pool] Unexpected pool error", err.message);
    });
  }
  return poolInstance;
}

export interface PoolStats {
  total: number;
  idle: number;
  active: number;
  waiting: number;
}

/** Returns stats for the current pg Pool instance. */
export function getPoolStats(): PoolStats {
  const p = getPool();
  return {
    total: p.totalCount,
    idle: p.idleCount,
    active: p.totalCount - p.idleCount,
    waiting: p.waitingCount,
  };
}

function isConnectionError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || "").toLowerCase();
  const code = String(err.code || "");
  return (
    msg.includes("timeout exceeded") ||
    msg.includes("timeout exceeded when trying to connect") ||
    msg.includes("connection timeout") ||
    msg.includes("connect etimedout") ||
    msg.includes("econnrefused") ||
    msg.includes("econnreset") ||
    msg.includes("connection terminated") ||
    msg.includes("pool is closed") ||
    msg.includes("pool is full") ||
    msg.includes("max client connections") ||
    msg.includes("too many clients") ||
    msg.includes("remaining connection slots") ||
    msg.includes("endpoint id is not specified") ||
    msg.includes("endpoint id") ||
    msg.includes("inconsistent project name") ||
    code === "28000" ||
    code === "57P01" ||
    code === "53300" ||
    code === "08006" ||
    code === "08001" ||
    code === "08004"
  );
}

export interface RetryOptions {
  retries?: number;
  delayMs?: number;
  backoffFactor?: number;
  routeName?: string;
}

/** Executed a query/operation with automatic exponential backoff retries on connection establishment failures. */
export async function queryWithRetry<T = any>(
  queryFn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.retries ?? 2;
  let delay = options.delayMs ?? 500;
  const backoff = options.backoffFactor ?? 2;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await queryFn();
    } catch (err: any) {
      if (err?.code === '42703') {
        console.error(
          `[SCHEMA MISMATCH WARNING] Database query failed with code 42703 (undefined_column) on route "${options.routeName || "query"}": ${err.message}`
        );
      }
      const connErr = isConnectionError(err);
      if (connErr && attempt <= maxRetries) {
        const stats = getPoolStats();
        console.warn(
          `[DB Retry] Connection error on attempt ${attempt}/${maxRetries + 1} (${options.routeName || "query"}): "${err.message}". Retrying in ${delay}ms... [Pool stats: total=${stats.total}, active=${stats.active}, idle=${stats.idle}, waiting=${stats.waiting}]`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= backoff;
      } else {
        throw err;
      }
    }
  }
  throw new Error("Unreachable");
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
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query("SELECT 1");
  } finally {
    client.release();
  }
}

/** Lightweight health check / warm-up ping to database on boot. */
export async function warmupDb(): Promise<void> {
  console.log("[DB Warmup] Triggering database pool warm-up ping...");
  try {
    await queryWithRetry(
      async () => {
        const p = getPool();
        const client = await p.connect();
        try {
          await client.query("SELECT 1;");
        } finally {
          client.release();
        }
      },
      { retries: 2, delayMs: 1000, routeName: "DB Boot Warmup" }
    );
    console.log("[DB Warmup] Connection pool warmed up successfully.");
  } catch (err: any) {
    console.error("[DB Warmup] Warm-up ping failed (requests will retry dynamically):", err.message);
  }
}

function getDb() {
  if (!dbInstance) {
    dbInstance = drizzle(pool, { schema });
  }
  return dbInstance;
}

export const pool: pg.Pool = new Proxy({} as pg.Pool, {
  get(target, prop, receiver) {
    if (prop === "then") return undefined;
    const realPool = getPool();
    const value = Reflect.get(realPool, prop, receiver);

    if (prop === "query") {
      return function queryWithPoolRetry(...args: any[]) {
        if (typeof args[args.length - 1] === "function") {
          return realPool.query.apply(realPool, args as any);
        }
        return queryWithRetry(
          () => realPool.query.apply(realPool, args as any) as unknown as Promise<any>,
          { retries: 2, delayMs: 500, backoffFactor: 2, routeName: "pool.query" }
        );
      };
    }

    if (prop === "connect") {
      return function connectWithPoolRetry(...args: any[]) {
        if (typeof args[0] === "function") {
          return realPool.connect.apply(realPool, args as any);
        }
        return queryWithRetry(
          () => realPool.connect.apply(realPool, args as any) as unknown as Promise<any>,
          { retries: 2, delayMs: 500, backoffFactor: 2, routeName: "pool.connect" }
        );
      };
    }

    return typeof value === "function" ? value.bind(realPool) : value;
  }
});

export const db: ReturnType<typeof drizzle<typeof schema>> = new Proxy({} as any, {
  get(target, prop, receiver) {
    if (prop === "then") return undefined;
    return Reflect.get(getDb(), prop, receiver);
  }
});

export * from "./schema/index";
