import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: 'postgresql://postgres:hatafrakshi@db.qnflaeexcmwwcabrcrhb.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const comms = await pool.query('SELECT id, name FROM committees ORDER BY id');
  for (const c of comms.rows) {
    const res = await pool.query(`
      SELECT DISTINCT distribution_date, notes
      FROM gift_distributions
      WHERE committee_id = $1
      ORDER BY distribution_date ASC
    `, [c.id]);

    const months = new Set();
    res.rows.forEach(r => {
      const mMatch = (r.notes || '').match(/Month:\s*([^|]+)/i);
      if (mMatch) months.add(`${mMatch[1].trim()} (${r.distribution_date ? new Date(r.distribution_date).toISOString().split('T')[0] : 'no-date'})`);
    });

    console.log(`\n=== Committee ID ${c.id}: ${c.name} (${res.rows.length} total records) ===`);
    console.log(Array.from(months));
  }
  await pool.end();
}

main().catch(console.error);
