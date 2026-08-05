import pg from 'pg';
const pool = new pg.Pool({ 
  connectionString: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb',
  ssl: { rejectUnauthorized: false }
});
const tables = [
  'interest_accounts', 'interest_transactions',
  'mi_accounts', 'mi_payments', 'interest_payments',
  'payment_ledger', 'loan_accounts', 'loan_payments', 'loan_documents'
];
for (const t of tables) {
  const r = await pool.query(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position`, [t]
  );
  if (r.rows.length) {
    console.log(`\n=== ${t} ===`);
    r.rows.forEach(c => console.log(`  ${c.column_name}: ${c.data_type} ${c.is_nullable==='NO'?'NOT NULL':''}`));
  } else {
    console.log(`\n${t}: (does not exist)`);
  }
}
await pool.end();
