import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ 
  connectionString: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb',
  ssl: { rejectUnauthorized: false }
});
try {
  const r = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'customers' ORDER BY ordinal_position`);
  console.log('customers columns:', r.rows.map(c => c.column_name).join(', '));
  const r2 = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'collections' ORDER BY ordinal_position`);
  console.log('collections columns:', r2.rows.map(c => c.column_name).join(', '));
} catch(e) {
  console.error('ERROR:', e.message);
}
await pool.end();
