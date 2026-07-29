import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres:hatafrakshi@db.qnflaeexcmwwcabrcrhb.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const client = await pool.connect();
  try {
    const tables = ['collections', 'tokens', 'customers', 'committees'];
    for (const t of tables) {
      const res = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = '${t}'`);
      console.log(`Columns of ${t}:`, res.rows.map(r => r.column_name).join(', '));
    }
  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(console.error);
