import pg from 'pg';
import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

const PROD_URL = 'postgresql://postgres:shreeassociation2026@db.ovtzfzeodcksosfwjibf.supabase.co:5432/postgres';

const pool = new pg.Pool({ connectionString: PROD_URL, ssl: { rejectUnauthorized: false }, max: 2 });

try {
  const r = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM customers)::int AS customers,
      (SELECT COUNT(*) FROM committees)::int AS committees,
      (SELECT COUNT(*) FROM collections)::int AS collections,
      (SELECT COUNT(*) FROM tokens)::int AS tokens
  `);
  console.log('Production DB counts:', r.rows[0]);

  // Check if V2 tables exist
  const t = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public'
      AND table_name IN ('mi_accounts','mi_payments','byaj_accounts','byaj_payments','payment_ledger','loan_accounts')
    ORDER BY table_name
  `);
  console.log('V2 tables present:', t.rows.map(r=>r.table_name).join(', ') || '(none)');

  // Check customer ID type
  const c = await pool.query(`SELECT id, name FROM customers LIMIT 2`);
  console.log('Customer ID type:', typeof c.rows[0]?.id, 'value:', c.rows[0]?.id);
} catch(e) {
  console.error('Connection error:', e.message);
}
await pool.end();
