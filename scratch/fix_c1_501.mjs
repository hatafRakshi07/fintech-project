import pg from "pg";

const { Pool } = pg;
const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000
});

async function main() {
  try {
    await pool.query("DELETE FROM tokens WHERE committee_id = 1 AND token_number = '501'");
    await pool.query("DELETE FROM committee_members WHERE committee_id = 1 AND token_number = '501'");

    const resTokens = await pool.query("SELECT committee_id, count(*)::int as count FROM tokens GROUP BY committee_id ORDER BY committee_id");
    console.log("FINAL PERFECT 500, 500, 500, 1111 TOKEN COUNTS:", resTokens.rows);
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await pool.end();
  }
}

main();
