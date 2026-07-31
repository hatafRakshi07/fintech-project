import pg from "pg";

const { Pool } = pg;
const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000
});

async function main() {
  try {
    const res = await pool.query(`
      SELECT token_number, count(*) 
      FROM tokens 
      WHERE committee_id = 1 
      GROUP BY token_number 
      HAVING count(*) > 1
    `);
    console.log("Duplicate token_numbers in Committee 1:", res.rows);
    if (res.rows.length > 0) {
      const dupTok = res.rows[0].token_number;
      await pool.query("DELETE FROM tokens WHERE id IN (SELECT id FROM tokens WHERE committee_id = 1 AND token_number = $1 LIMIT 1)", [dupTok]);
      console.log(`Deleted duplicate token ${dupTok}`);
    }

    const resTokens = await pool.query("SELECT committee_id, count(*)::int as count FROM tokens GROUP BY committee_id ORDER BY committee_id");
    console.log("FINAL EXACT COUNTS:", resTokens.rows);
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await pool.end();
  }
}

main();
