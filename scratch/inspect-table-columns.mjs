import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function inspectColumns() {
  const client = await pool.connect();
  const tables = ['gift_distributions', 'gift_winners', 'lotteries', 'daily_diary_payments', 'daily_diary_loans', 'collections', 'interest_accounts', 'interest_transactions', 'tokens', 'customers', 'committees'];
  try {
    for (const t of tables) {
      const res = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY ordinal_position;
      `, [t]);
      console.log(`\nTable "${t}":`);
      res.rows.forEach(r => console.log(`  - ${r.column_name} (${r.data_type})`));
    }
  } finally {
    client.release();
    await pool.end();
  }
}

inspectColumns();
