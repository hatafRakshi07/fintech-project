import pg from "pg";
const { Pool } = pg;
const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false }, max: 1
});

async function main() {
  const client = await pool.connect();
  try {
    console.log("--- collections count per committee ---");
    const col = await client.query("SELECT committee_id, COUNT(*), SUM(amount) FROM collections GROUP BY committee_id ORDER BY committee_id");
    console.log(col.rows);

    console.log("\n--- collections duplicate check ---");
    const colDup = await client.query(`
      SELECT committee_id, customer_id, collected_at, amount, COUNT(*)
      FROM collections
      GROUP BY committee_id, customer_id, collected_at, amount
      HAVING COUNT(*) > 1
      LIMIT 10
    `);
    console.log("collections duplicates:", colDup.rows);

  } finally {
    client.release();
    await pool.end();
  }
}
main();
