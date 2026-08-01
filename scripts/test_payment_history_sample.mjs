import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: 'postgresql://postgres:hatafrakshi@db.qnflaeexcmwwcabrcrhb.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const res = await pool.query(`
    SELECT c.id, c.committee_id, c.amount, c.notes, c.collected_at::date as date, cust.name
    FROM collections c
    JOIN customers cust ON cust.id = c.customer_id
    ORDER BY c.id DESC LIMIT 15
  `);
  console.log('Updated Payment History Sample:');
  console.table(res.rows);
  await pool.end();
}

main().catch(console.error);
