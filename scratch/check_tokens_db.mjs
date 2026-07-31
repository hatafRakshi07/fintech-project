import pg from "pg";
const { Pool } = pg;
const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false }, max: 1
});

async function main() {
  const client = await pool.connect();
  try {
    console.log("--- committee_members count ---");
    const cm = await client.query("SELECT committee_id, COUNT(*) FROM committee_members GROUP BY committee_id ORDER BY committee_id");
    console.log(cm.rows);

    console.log("\n--- tokens count ---");
    const tok = await client.query("SELECT committee_id, COUNT(*) FROM tokens GROUP BY committee_id ORDER BY committee_id");
    console.log(tok.rows);

    console.log("\n--- committee_members duplicates check ---");
    const cmDup = await client.query(`
      SELECT committee_id, token_number, COUNT(*)
      FROM committee_members
      GROUP BY committee_id, token_number
      HAVING COUNT(*) > 1
      LIMIT 10
    `);
    console.log("cm duplicates:", cmDup.rows);

    console.log("\n--- tokens duplicates check ---");
    const tokDup = await client.query(`
      SELECT committee_id, token_number, COUNT(*)
      FROM tokens
      GROUP BY committee_id, token_number
      HAVING COUNT(*) > 1
      LIMIT 10
    `);
    console.log("tokens duplicates:", tokDup.rows);

  } finally {
    client.release();
    await pool.end();
  }
}
main();
