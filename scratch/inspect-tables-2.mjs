import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('=== ALL TABLES IN NEON DB ===');
  const tRes = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
  console.log(tRes.rows.map(r => r.table_name));

  console.log('\n=== GIFT_DISTRIBUTIONS COLUMNS ===');
  const gdCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='gift_distributions' ORDER BY ordinal_position");
  console.table(gdCols.rows);

  console.log('\n=== SAMPLE GIFT_DISTRIBUTIONS (First 5) ===');
  const gdSample = await pool.query("SELECT * FROM gift_distributions LIMIT 5");
  console.table(gdSample.rows);

  console.log('\n=== DAILY DIARY / COLLECTIONS / OTHER PAYMENT TABLES ===');
  for (const tbl of ['daily_diary', 'cashbook_entries', 'financial_transactions', 'collections', 'payments', 'monthly_payments', 'bissi_payments']) {
    try {
      const cnt = await pool.query(`SELECT COUNT(*)::int FROM ${tbl}`);
      console.log(`${tbl} count:`, cnt.rows[0].count);
    } catch (e) {
      console.log(`${tbl}: DOES NOT EXIST`);
    }
  }

  await pool.end();
}

main().catch(console.error);
