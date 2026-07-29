import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log("=== BATCH UPDATING TRANSACTION & LOTTERY DATES ===");

  // 1. Update collections dates based on 'Installment M...' notes
  console.log("Updating collection dates based on Installment Month M1...M24...");
  const updateCollectionsRes = await pool.query(`
    UPDATE collections
    SET collected_at = (
      CASE 
        WHEN notes ~ 'Installment M([0-9]+)' THEN 
          MAKE_DATE(
            2024 + ((CAST(substring(notes from 'Installment M([0-9]+)') AS INT) - 1) / 12),
            ((CAST(substring(notes from 'Installment M([0-9]+)') AS INT) - 1) % 12) + 1,
            LEAST(10 + (id % 15), 28)
          )::timestamp with time zone
        ELSE NOW() - INTERVAL '3 months'
      END
    )
    WHERE notes ~ 'Installment M[0-9]+'
  `);
  console.log(`Updated ${updateCollectionsRes.rowCount} collection transaction dates accurately!`);

  // 2. Re-align lotteries dates for all 4 committees across 2023-2025
  console.log("Re-aligning lottery draw dates across 2023-2025...");
  
  const drawDayMap = { 1: 5, 2: 15, 3: 20, 4: 10 };

  for (let c_id = 1; c_id <= 4; c_id++) {
    const drawDay = drawDayMap[c_id] || 15;
    const res = await pool.query("SELECT id FROM lotteries WHERE committee_id = $1 ORDER BY id ASC", [c_id]);
    const ids = res.rows.map(r => r.id);
    if (ids.length === 0) continue;

    console.log(`Committee #${c_id}: Batch updating ${ids.length} lotteries...`);

    // Group into 24 monthly slots
    const perMonth = Math.ceil(ids.length / 24) || 1;

    for (let monthIdx = 0; monthIdx < 24; monthIdx++) {
      const year = 2023 + Math.floor(monthIdx / 12);
      const month = (monthIdx % 12) + 1;
      const monthStr = String(month).padStart(2, '0');
      const dayStr = String(drawDay).padStart(2, '0');
      const dateStr = `${year}-${monthStr}-${dayStr}`;

      const chunk = ids.slice(monthIdx * perMonth, (monthIdx + 1) * perMonth);
      if (chunk.length > 0) {
        await pool.query(
          "UPDATE lotteries SET draw_date = $1 WHERE id = ANY($2::int[])",
          [dateStr, chunk]
        );
      }
    }
  }

  console.log("Successfully updated all collection transaction dates & lottery draw dates!");
  await pool.end();
}

main().catch(err => {
  console.error("Error in batch update:", err);
  pool.end();
});
