import pg from 'pg';
const pool = new pg.Pool({ 
  connectionString: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb',
  ssl: { rejectUnauthorized: false }
});
// Check what tables exist after partial migration
const r = await pool.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('mi_accounts','mi_payments','byaj_accounts','byaj_payments','payment_ledger','loan_accounts','loan_payments','loan_documents','v2_mi_accounts','v2_byaj_accounts')
  ORDER BY table_name
`);
console.log('Existing new tables:', r.rows.map(t=>t.table_name).join(', ') || '(none)');

// Check what columns were added to customers
const c = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='customers' ORDER BY ordinal_position`);
console.log('customers cols:', c.rows.map(r=>r.column_name).join(', '));

await pool.end();
