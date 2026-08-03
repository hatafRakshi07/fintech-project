import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function run() {
  const query = `
    SELECT DISTINCT TO_CHAR(collected_at, 'Mon YYYY') as month_str, DATE_TRUNC('month', collected_at) as month_date
    FROM collections
    WHERE collected_at IS NOT NULL
    ORDER BY DATE_TRUNC('month', collected_at) ASC;
  `;

  const res = await pool.query(query);
  const dbMonths = res.rows.map(r => r.month_str);
  console.log('DB Distinct Months:', dbMonths);

  // Generate continuous months from min date to current date + 1 year
  const minDate = res.rows[0]?.month_date ? new Date(res.rows[0].month_date) : new Date(2024, 0, 1);
  const now = new Date();
  const maxDate = new Date(now.getFullYear() + 1, 11, 1); // 1 year in future

  const allMonths = [];
  let curr = new Date(minDate.getFullYear(), minDate.getMonth(), 1);

  while (curr <= maxDate) {
    const label = curr.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    const isCurrent = curr.getFullYear() === now.getFullYear() && curr.getMonth() === now.getMonth();
    allMonths.push(isCurrent ? `${label} (Current)` : label);
    curr.setMonth(curr.getMonth() + 1);
  }

  console.log('Generated Continuous Available Months:', allMonths.length, 'months');
  console.log('Sample:', allMonths.slice(0, 15), '...', allMonths.slice(-5));
  await pool.end();
}

run().catch(console.error);
