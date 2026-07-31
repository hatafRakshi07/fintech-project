import pg from "pg";
const { Pool } = pg;
const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false }, max: 1
});
async function main() {
  const client = await pool.connect();
  try {
    // Sample lotteries with reward_type = gift
    const r1 = await client.query(`
      SELECT l.id, c.name as bissi, cust.name as winner, l.draw_date, l.notes, l.reward_type, l.status
      FROM lotteries l
      JOIN committees c ON c.id = l.committee_id
      JOIN customers cust ON cust.id = l.winner_id
      ORDER BY l.draw_date DESC LIMIT 20
    `);
    console.log("Sample lotteries:", JSON.stringify(r1.rows, null, 2));
    
    // Check reward_type column exists and values
    const r2 = await client.query(`
      SELECT reward_type, COUNT(*) FROM lotteries GROUP BY reward_type
    `);
    console.log("\nReward types:", r2.rows);

    // Check per bissi + per month gift counts
    const r3 = await client.query(`
      SELECT c.name, TO_CHAR(l.draw_date, 'Mon YYYY') as month, COUNT(*) as gifts
      FROM lotteries l
      JOIN committees c ON c.id = l.committee_id
      WHERE l.reward_type = 'gift' OR l.notes NOT SIMILAR TO '%[0-9]%'
      GROUP BY c.name, TO_CHAR(l.draw_date, 'Mon YYYY'), DATE_TRUNC('month', l.draw_date)
      ORDER BY c.name, DATE_TRUNC('month', l.draw_date) DESC
      LIMIT 20
    `);
    console.log("\nGift records per bissi per month:", r3.rows);
  } finally {
    client.release();
    await pool.end();
  }
}
main();
