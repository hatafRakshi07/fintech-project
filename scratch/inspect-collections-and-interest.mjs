import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('=== COLLECTIONS COLUMNS & SAMPLE ===');
  const colCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='collections' ORDER BY ordinal_position");
  console.table(colCols.rows);
  const colSample = await pool.query("SELECT * FROM collections LIMIT 5");
  console.table(colSample.rows);

  console.log('\n=== INTEREST / BYAJ TABLES COUNTS & SAMPLES ===');
  for (const tbl of ['byaj_accounts', 'byaj_payments', 'interest_accounts', 'interest_transactions', 'lotteries', 'lottery_gifts', 'lottery_sessions', 'loans', 'loan_payments']) {
    try {
      const cnt = await pool.query(`SELECT COUNT(*)::int FROM ${tbl}`);
      console.log(`${tbl} count:`, cnt.rows[0].count);
      if (cnt.rows[0].count > 0) {
        const sample = await pool.query(`SELECT * FROM ${tbl} LIMIT 3`);
        console.table(sample.rows);
      }
    } catch (e) {
      console.log(`${tbl}: ERROR ${e.message}`);
    }
  }

  await pool.end();
}

main().catch(console.error);
