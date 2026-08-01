import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: 'postgresql://postgres:hatafrakshi@db.qnflaeexcmwwcabrcrhb.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const colCount = await pool.query("SELECT COUNT(*)::int as total FROM collections");
  console.log('collections table total count:', colCount.rows[0].total);

  const colDaily = await pool.query("SELECT COUNT(*)::int as count FROM collections WHERE notes ILIKE '%Daily Collection%'");
  console.log('collections table Daily Collection notes count:', colDaily.rows[0].count);

  const instCount = await pool.query("SELECT COUNT(*)::int as total FROM installments");
  console.log('installments table total count:', instCount.rows[0].total);

  const instDaily = await pool.query("SELECT COUNT(*)::int as count FROM installments WHERE remarks ILIKE '%Daily Collection%' OR notes ILIKE '%Daily Collection%'");
  console.log('installments table Daily Collection remarks count:', instDaily.rows[0].count);

  const sampleInst = await pool.query("SELECT id, committee_id, amount, remarks, notes, payment_date FROM installments ORDER BY id DESC LIMIT 10");
  console.log('\nSample from installments table:');
  console.table(sampleInst.rows);

  const sampleCol = await pool.query("SELECT id, committee_id, amount, notes, collected_at FROM collections ORDER BY id DESC LIMIT 10");
  console.log('\nSample from collections table:');
  console.table(sampleCol.rows);

  await pool.end();
}

main().catch(console.error);
