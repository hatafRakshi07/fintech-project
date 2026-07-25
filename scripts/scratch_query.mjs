import pg from "pg";
const { Pool } = pg;

async function main() {
  const neon = "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require";
  const pool = new Pool({
    connectionString: neon,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const res = await pool.query(`
      SELECT c.id, c.name, c.mobile, COUNT(t.id) as token_count 
      FROM customers c
      LEFT JOIN tokens t ON t.customer_id = c.id
      WHERE c.status = 'active'
      GROUP BY c.id, c.name, c.mobile
      HAVING COUNT(t.id) > 0
      LIMIT 5
    `);
    console.log("CUSTOMERS:", JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error("Query Failed:", err.message);
  } finally {
    await pool.end();
  }
}

main();
