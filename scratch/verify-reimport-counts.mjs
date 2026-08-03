import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function verifyCounts() {
  const client = await pool.connect();
  try {
    console.log("=== DATABASE RECORD COUNTS AFTER REIMPORT ===");
    const tables = [
      'customers',
      'tokens',
      'committees',
      'gift_distributions',
      'lotteries',
      'interest_accounts',
      'interest_transactions',
      'daily_diary_loans',
      'collections'
    ];

    for (const t of tables) {
      const res = await client.query(`SELECT COUNT(*)::int as count FROM ${t}`);
      console.log(`Table "${t}": ${res.rows[0].count} records`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

verifyCounts();
