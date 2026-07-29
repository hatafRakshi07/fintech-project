import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log("=== RE-ALIGNING LOTTERY DATES TO MONTHLY DRAWS (2023-2025) ===");

  const drawDayMap = { 1: 5, 2: 15, 3: 20, 4: 10 };

  for (let c_id = 1; c_id <= 4; c_id++) {
    const drawDay = drawDayMap[c_id] || 15;
    
    // Fetch all lotteries for this committee ordered by id
    const res = await pool.query("SELECT id FROM lotteries WHERE committee_id = $1 ORDER BY id ASC", [c_id]);
    const rows = res.rows;
    if (rows.length === 0) continue;

    console.log(`Committee #${c_id}: ${rows.length} lotteries found.`);

    // Distribute rows across 24 monthly draw slots (2023-01 to 2024-12)
    const itemsPerMonth = Math.ceil(rows.length / 24) || 1;

    for (let i = 0; i < rows.length; i++) {
      const monthIdx = Math.floor(i / itemsPerMonth);
      const year = 2023 + Math.floor(monthIdx / 12);
      const month = (monthIdx % 12);
      
      const drawDate = new Date(year, month, drawDay);
      const dateStr = drawDate.toISOString().split("T")[0];

      await pool.query("UPDATE lotteries SET draw_date = $1 WHERE id = $2", [dateStr, rows[i].id]);
    }
  }

  console.log("Successfully re-aligned all lottery draw dates to 2023-2025!");
  await pool.end();
}

main().catch(err => {
  console.error("Error re-aligning dates:", err);
  pool.end();
});
