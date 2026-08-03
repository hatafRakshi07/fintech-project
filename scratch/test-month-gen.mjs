import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function run() {
  const minMonthRes = await pool.query(`
    SELECT MIN(min_date) as min_date FROM (
      SELECT MIN(created_at) as min_date FROM committees
      UNION ALL
      SELECT MIN(collected_at) as min_date FROM collections WHERE collected_at IS NOT NULL
    ) sub
  `);
  const minDateRaw = minMonthRes.rows[0]?.min_date;
  const minDate = minDateRaw ? new Date(minDateRaw) : new Date(2023, 5, 1);
  const now = new Date();
  const maxDate = new Date(now.getFullYear(), now.getMonth() + 4, 1);

  const availableMonths = [];
  let curr = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  while (curr <= maxDate) {
    const label = curr.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    if (!availableMonths.includes(label)) {
      availableMonths.push(label);
    }
    curr.setMonth(curr.getMonth() + 1);
  }

  console.log("Min Date found:", minDateRaw);
  console.log("Generated Available Months count:", availableMonths.length);
  console.log("Available Months list:", availableMonths);

  await pool.end();
}

run().catch(console.error);
