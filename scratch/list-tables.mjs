import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ 
  connectionString: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb',
  ssl: { rejectUnauthorized: false }
});
try {
  const r = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`);
  console.log('Tables:', r.rows.map(t => t.table_name).join(', '));
} catch(e) {
  console.error('ERROR:', e.message);
}
await pool.end();
