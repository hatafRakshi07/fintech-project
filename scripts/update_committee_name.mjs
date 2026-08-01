import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: 'postgresql://postgres:hatafrakshi@db.qnflaeexcmwwcabrcrhb.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await pool.query("UPDATE committees SET name = 'Shree Krishna Associate Bissi (10th Date)' WHERE id = 4");
  const res = await pool.query("SELECT id, name, installment_amount, member_limit FROM committees ORDER BY id");
  console.log("All 4 Committees Updated:");
  console.table(res.rows);
  await pool.end();
}

main().catch(console.error);
