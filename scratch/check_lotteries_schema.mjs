import pg from "pg";
const { Pool } = pg;
const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false }, max: 1
});

async function main() {
  const client = await pool.connect();
  try {
    const colRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'lotteries'
    `);
    console.log("Lotteries columns:", colRes.rows);

    const sample = await client.query("SELECT * FROM lotteries WHERE winner_id IS NOT NULL LIMIT 5");
    console.log("\nSample lotteries:", sample.rows);
  } finally {
    client.release();
    await pool.end();
  }
}
main();
