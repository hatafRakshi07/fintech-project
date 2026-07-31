import pg from "pg";

const { Pool } = pg;
const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000
});

async function main() {
  try {
    await pool.query("DELETE FROM tokens WHERE committee_id = 1 AND CAST(token_number AS integer) > 500");
    await pool.query("DELETE FROM committee_members WHERE committee_id = 1 AND CAST(token_number AS integer) > 500");
    console.log("Token 501 cleaned up!");

    const resTokens = await pool.query("SELECT committee_id, count(*)::int as count FROM tokens GROUP BY committee_id ORDER BY committee_id");
    console.log("FINAL EXACT Token counts per committee:", resTokens.rows);
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await pool.end();
  }
}

main();
