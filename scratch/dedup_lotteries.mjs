import pg from "pg";
const { Pool } = pg;
const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false }, max: 1
});

async function main() {
  const client = await pool.connect();
  try {
    // Count before
    const before = await client.query("SELECT COUNT(*) FROM lotteries");
    console.log("Before:", before.rows[0].count);

    // Remove ALL duplicates - keep only 1 row per (committee_id, winner_id, draw_date, notes)
    await client.query(`
      DELETE FROM lotteries
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM lotteries
        GROUP BY committee_id, winner_id, draw_date, notes
      )
    `);

    const after = await client.query("SELECT COUNT(*) FROM lotteries");
    console.log("After dedup:", after.rows[0].count);

    // Per committee
    const perComm = await client.query(`
      SELECT c.name, COUNT(l.id) as cnt
      FROM lotteries l JOIN committees c ON l.committee_id = c.id
      GROUP BY c.id, c.name ORDER BY c.id
    `);
    perComm.rows.forEach(r => console.log(` ${r.name}: ${r.cnt}`));

  } finally {
    client.release();
    await pool.end();
  }
}
main();
