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
      SELECT c.id, c.name, COUNT(l.id)::int as gifts_count
      FROM committees c
      LEFT JOIN lotteries l ON l.committee_id = c.id
      GROUP BY c.id, c.name
      ORDER BY c.id
    `);
    console.log("GIFTS / LOTTERIES COUNT PER BISSI SCHEME:");
    console.log(res.rows);
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await pool.end();
  }
}

main();
