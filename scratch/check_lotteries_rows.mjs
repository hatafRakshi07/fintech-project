import pg from "pg";

const { Pool } = pg;
const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000
});

async function main() {
  try {
    const resCount = await pool.query("SELECT count(*)::int as count FROM lotteries");
    console.log("Total lotteries count in DB:", resCount.rows[0].count);

    const resStatuses = await pool.query("SELECT status::text, count(*)::int FROM lotteries GROUP BY status");
    console.log("Lotteries by status:", resStatuses.rows);

    const resSample = await pool.query(`
      SELECT 
        l.id,
        l.committee_id as "committeeId",
        l.draw_date as "drawDate",
        l.winner_id as "winnerId",
        l.notes,
        l.status::text as "status",
        c.name as "committeeName",
        cust.name as "winnerName"
      FROM lotteries l
      LEFT JOIN committees c ON l.committee_id = c.id
      LEFT JOIN customers cust ON l.winner_id = cust.id
      ORDER BY l.id DESC
      LIMIT 5
    `);
    console.log("Sample lotteries query output:", resSample.rows);

  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await pool.end();
  }
}

main();
