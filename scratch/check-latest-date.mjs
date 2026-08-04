import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function run() {
  const colMax = await pool.query("SELECT MAX(collected_at) as max_date, COUNT(*) as count FROM collections");
  const tokMax = await pool.query("SELECT MAX(created_at) as max_date, COUNT(*) as count FROM tokens");
  const custMax = await pool.query("SELECT MAX(created_at) as max_date, COUNT(*) as count FROM customers");
  const lotMax = await pool.query("SELECT MAX(draw_date) as max_date, COUNT(*) as count FROM lotteries");
  const commMax = await pool.query("SELECT MAX(created_at) as max_date, COUNT(*) as count FROM committees");

  console.log("Collections Max Date:", colMax.rows[0].max_date, "| Total Receipts:", colMax.rows[0].count);
  console.log("Tokens Max Date:", tokMax.rows[0].max_date, "| Total Tokens:", tokMax.rows[0].count);
  console.log("Customers Max Date:", custMax.rows[0].max_date, "| Total Customers:", custMax.rows[0].count);
  console.log("Lotteries Max Date:", lotMax.rows[0].max_date, "| Total Lotteries:", lotMax.rows[0].count);
  console.log("Committees Max Date:", commMax.rows[0].max_date, "| Total Committees:", commMax.rows[0].count);

  // Breakdown of collections by year/month
  const monthlyRes = await pool.query(`
    SELECT TO_CHAR(collected_at, 'YYYY-MM') as yyyymm, COUNT(*) as count, SUM(amount) as total
    FROM collections
    GROUP BY TO_CHAR(collected_at, 'YYYY-MM')
    ORDER BY yyyymm DESC
    LIMIT 12
  `);
  console.log("\nLatest 12 Months Collections Summary:");
  console.table(monthlyRes.rows);

  await pool.end();
}

run().catch(console.error);
