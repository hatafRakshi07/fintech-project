import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ 
  connectionString: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000
});
try {
  const r = await pool.query('SELECT COUNT(*) as cnt FROM customers');
  console.log('DB OK, customers:', r.rows[0].cnt);
  const r2 = await pool.query('SELECT COUNT(*) as cnt FROM collections');
  console.log('DB OK, collections:', r2.rows[0].cnt);
} catch(e) {
  console.error('DB ERROR:', e.message);
}
await pool.end();
