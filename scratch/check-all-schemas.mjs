import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ 
  connectionString: 'postgresql://neondb_owner:npg_qSQN29ZxTKzt@ep-frosty-cloud-at51tjed-pooler.c-9.us-east-1.aws.neon.tech/neondb',
  ssl: { rejectUnauthorized: false }
});
try {
  const tables = ['customers', 'committees', 'tokens', 'collections', 'lotteries', 'gifts', 'branches'];
  for (const table of tables) {
    const r = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`, [table]);
    if (r.rows.length > 0) {
      console.log(`${table}: ${r.rows.map(c => c.column_name).join(', ')}`);
    } else {
      console.log(`${table}: (table not found or empty)`);
    }
  }
} catch(e) {
  console.error('ERROR:', e.message);
}
await pool.end();
