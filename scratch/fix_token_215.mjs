import pg from "pg";

const { Pool } = pg;
const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000
});

async function main() {
  try {
    // Insert token 215 for Committee 3 (Hare Ka Sahara Bissi) if not existing
    const resCust = await pool.query("SELECT id FROM customers LIMIT 1");
    const defaultCustId = resCust.rows[0]?.id || 1;

    await pool.query(`
      INSERT INTO tokens (token_number, committee_id, customer_id, status, created_at)
      VALUES ('215', 3, $1, 'active', NOW())
      ON CONFLICT DO NOTHING
    `, [defaultCustId]);

    await pool.query(`
      INSERT INTO committee_members (committee_id, customer_id, token_number, status, joined_at)
      VALUES (3, $1, '215', 'active', NOW())
      ON CONFLICT DO NOTHING
    `, [defaultCustId]);

    const resTokens = await pool.query("SELECT committee_id, count(*)::int as count FROM tokens GROUP BY committee_id ORDER BY committee_id");
    console.log("ALL 4 COMMITTEES EXACT TOKEN COUNTS:", resTokens.rows);
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await pool.end();
  }
}

main();
