import pg from "pg";
const { Pool } = pg;
const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false }, max: 1
});

async function main() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT 
        l.id,
        l.committee_id as "committeeId",
        c.name as "committeeName",
        l.winner_id as "winnerId",
        cust.name as "winnerName",
        (
          SELECT t.token_number 
          FROM tokens t 
          WHERE t.customer_id = l.winner_id AND t.committee_id = l.committee_id 
          ORDER BY CASE WHEN t.token_number ~ '^[0-9]+$' THEN CAST(t.token_number AS integer) ELSE 99999 END ASC 
          LIMIT 1
        ) as "tokenNumber",
        l.draw_date as "drawDate",
        l.notes as "giftName",
        l.reward_type as "rewardType"
      FROM lotteries l
      JOIN committees c ON c.id = l.committee_id
      JOIN customers cust ON cust.id = l.winner_id
      WHERE l.status = 'completed' AND l.winner_id IS NOT NULL
      ORDER BY l.draw_date DESC, l.id DESC
      LIMIT 10
    `);
    console.log("Unique 1-to-1 lotteries query output:");
    console.log(res.rows);
  } finally {
    client.release();
    await pool.end();
  }
}
main();
