import pg from "pg";
const { Pool } = pg;
const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false }, max: 1
});

async function main() {
  const client = await pool.connect();
  try {
    console.log("--- Inspecting high amount collections ---");
    const res = await client.query(`
      SELECT committee_id, amount, COUNT(*)
      FROM collections
      WHERE committee_id IS NOT NULL
      GROUP BY committee_id, amount
      ORDER BY committee_id, amount DESC
      LIMIT 30
    `);
    console.log(res.rows);

    // Also check max amount rows
    const maxRes = await client.query(`
      SELECT id, committee_id, customer_id, amount, notes, collected_at
      FROM collections
      WHERE amount > 50000
      ORDER BY amount DESC
      LIMIT 10
    `);
    console.log("\nOutlier amounts > 50000:");
    console.log(maxRes.rows);

  } finally {
    client.release();
    await pool.end();
  }
}
main();
