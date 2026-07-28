import pg from "pg";
const { Pool } = pg;

async function inspectNeon() {
  const neon = "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require";
  const pool = new Pool({
    connectionString: neon,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
    console.log("=== NEON TABLES AND ROW COUNTS ===");
    for (const row of res.rows) {
      try {
        const countRes = await pool.query(`SELECT COUNT(*) FROM "${row.table_name}"`);
        console.log(`${row.table_name}: ${countRes.rows[0].count} rows`);
      } catch (err) {
        console.log(`${row.table_name}: ERROR (${err.message})`);
      }
    }
  } catch (err) {
    console.error("Inspection failed:", err);
  } finally {
    await pool.end();
  }
}

inspectNeon();
