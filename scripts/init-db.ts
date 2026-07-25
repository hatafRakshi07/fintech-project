import { pool, db } from "../lib/db/src/index.js";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Connecting to Supabase PostgreSQL...");
  const res = await db.execute(sql`SELECT current_database(), current_user, version();`);
  console.log("Connected successfully:", res.rows);
  await pool.end();
}

main().catch((err) => {
  console.error("Connection failed:", err);
  process.exit(1);
});
